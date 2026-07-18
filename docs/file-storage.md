# Файлы: загрузка, обработка, индексация в Qdrant

## Почему обработка файла не блокирует бэкенд

Крупные файлы уже не идут байтами через backend: клиент грузит части
напрямую в S3 по presigned URL (`POST /file/multipart/initiate` →
`/presign` → `PUT <url>` в S3 → `/complete`). Сервер на шаге `/complete`
только создаёт запись `FileAsset` и **ставит job в очередь** — сам HTTP-ответ
не ждёт извлечения текста, чанкинга или эмбеддингов.

Обработку выполняет отдельный воркер (`src/services/queue/worker.js`),
polling очередь в MongoDB (`src/models/job.model.js`,
`src/services/queue/job-queue.service.js`) с ограниченным concurrency.
Claim job — это один атомарный `findOneAndUpdate`, поэтому очередь безопасно
работает и с несколькими репликами сервера без дополнительной координации.
Если нагрузка вырастет — можно заменить транспорт на BullMQ + Redis, не
трогая обработчики job (см. `docs/open-questions.md`).

## S3-провайдер

`config/s3.config.js`/`src/services/s3.service.js` не завязаны на конкретного
провайдера — используется обычный `@aws-sdk/client-s3` поверх стандартного
S3 API, всё провайдер-специфичное вынесено в `.env` (`S3_ENDPOINT`,
`S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL`). Сейчас настроен **Timeweb Cloud**
(`https://s3.twcstorage.ru`, регион `ru-1`) — до этого был Yandex Cloud
Storage, переключение свелось к смене значений в `.env`, без правок кода.

`S3_FORCE_PATH_STYLE=true` обязателен для Timeweb (и большинства не-AWS
S3-совместимых хранилищ) — они не поддерживают virtual-hosted-style
адресацию бакета (`bucket.endpoint/key`), только path-style
(`endpoint/bucket/key`). `S3_PUBLIC_URL` можно не задавать — по умолчанию
публичная ссылка строится на основе `S3_ENDPOINT`; задать отдельно нужно,
только если объекты раздаются через отдельный CDN-домен.

Мультипарт-загрузка (`CreateMultipartUpload`/`UploadPart`/
`CompleteMultipartUpload`/`AbortMultipartUpload`) и presigned URL на части —
стандартные операции S3 API, Timeweb их поддерживает так же, как и Yandex,
логика в `s3.service.js` не менялась при смене провайдера. Загрузка частей
идёт напрямую из браузера по presigned URL — на бакете должен быть настроен
CORS (разрешение `PUT` с домена фронтенда), это делается в панели
управления провайдера, а не в коде.

Файлы, загруженные до смены провайдера, останутся с URL старого хранилища
в `File.url` — смена `.env` их не переносит; для полной миграции старые
объекты нужно скопировать в новый бакет отдельно.

## Пайплайн одного файла (`src/services/file-processing/process-file.job.js`)

1. По mimetype выбирается экстрактор (`extractors/index.js`). Нет
   экстрактора → `processingStatus=unsupported` (FILE-5), без падения.
2. Экстрактор — **асинхронный генератор**, отдающий чанки по мере готовности:
   - TXT/MD (`text.extractor.js`) — читает `GetObjectCommand` как поток и
     режет текст скользящим окном прямо во время чтения. Память ограничена
     размером окна (`CHUNK_SIZE` + `CHUNK_OVERLAP`), а не размером файла —
     файл на несколько сотен МБ не будет буферизован целиком.
   - PDF/DOCX (`желательно`, не обязательно по ТЗ) — `pdf-parse`/`mammoth`
     требуют весь буфер целиком, поэтому эти форматы буферизуются с жёстким
     лимитом размера (`MAX_BYTES`, сейчас 20 МБ); превышение лимита даёт
     `unsupported`, а не зависшую обработку.
3. Чанки эмбеддятся и пишутся в Qdrant пакетами (`EMBED_BATCH_SIZE=20`), а не
   все разом в конце — память снова ограничена размером пакета, а не файла.
4. Итоговый `File.textHash` — это hash конкатенации хэшей чанков (не самого
   текста), поэтому вычисляется потоково без хранения полного текста файла.

## Статусы

| Поле | Значения |
|---|---|
| `processingStatus` | uploaded, extracting, extracted, indexing, indexed, failed, unsupported |
| `extractedTextStatus` | not_started, success, empty, failed, unsupported |
| `qdrantStatus` | not_indexed, indexed, failed, stale |

Ошибка извлечения/эмбеддинга/Qdrant помечает файл `failed` немедленно (для
UI) и одновременно пробрасывается наверх — job-очередь делает retry с
задержкой согласно `maxAttempts`/backoff. Единственное исключение —
`FILE_TOO_LARGE_FOR_FORMAT`: это детерминированная (не временная) ошибка,
поэтому файл сразу помечается `unsupported` без бесполезных ретраев.

## Привязка файла к проекту

`FileAsset.projectId` — опциональное поле. Обработка запускается автоматически
только если `projectId` передан при `/file/upload` или
`/file/multipart/complete` (сервер проверяет владение проектом). Без
`projectId` файл остаётся обычным пользовательским файлом вне экспертного
контекста.

Ручной перезапуск индексации — `POST /accelerator/projects/:projectId/files/:fileId/index`.
Статус — `GET /accelerator/projects/:projectId/files/:fileId/processing-status`.

## Известные ограничения

- **PDF/DOCX парсятся синхронно в воркер-процессе.** Лимит `MAX_BYTES`
  ограничивает худший случай, но сам парсинг не вынесен в `worker_threads` —
  очень большой (но всё ещё в пределах лимита) PDF может на короткое время
  занять event loop воркера. Это осознанный компромисс: TXT/MD (обязательный
  по ТЗ формат) обрабатываются потоково и от этой проблемы не страдают;
  PDF/DOCX помечены в ТЗ как «желательно». Если реальная нагрузка потребует
  больше — следующий шаг: вынести `pdf.extractor.js`/`docx.extractor.js` в
  `worker_threads`, не меняя остальной пайплайн.
- **Повтор job после сбоя пере-эмбеддит уже обработанные пакеты с нуля** —
  безопасно (upsert по детерминированным id идемпотентен), но не бесплатно
  по вызовам embeddings API. Приемлемо для MVP; при росте нагрузки стоит
  сохранять прогресс по чанкам в самой job.
