# rocketmind-services

Бэкенд Rocketmind: обучающий контур (`study`) и Р-Акселератор (`accelerator`).

Документация по устройству — в `docs/`:

- `docs/accelerator/README.md` — как работает пайплайн Акселератора;
- `docs/accelerator/agent-setup.md` — настройка агента: какие поля обязательны и как писать промпты;
- `docs/accelerator/frontend-integration.md` — контракт с фронтом (SSE, кнопки, коды ошибок);
- `docs/data-model.md`, `docs/file-storage.md` — модель данных и хранилище;
- Swagger живой: `GET /api/docs` (спека — `/api/docs/swagger.json`).

## Локальный запуск через Docker

`docker-compose.yml` поднимает бэк вместе со всем, что в проде внешнее:
MongoDB, Qdrant, S3 (MinIO вместо Timeweb Cloud) и SMTP (Mailpit).

```sh
cp .env.example .env      # достаточно вписать OPENAI_API_KEY и OPENROUTER_API_KEY
docker compose up -d --build
```

| Что | Адрес |
|---|---|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| Почта (коды входа) | http://localhost:8025 |
| Консоль MinIO | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| Qdrant | http://localhost:6333/dashboard |
| MongoDB | `mongodb://localhost:27017/r-accelerator` |

Адреса инфраструктуры заданы прямо в `docker-compose.yml` и **не** читаются из
`.env`: внутри compose-сети сервисы зовутся `mongo`, `qdrant`, `minio`, и это не
то, что лежит в `.env` для прода. Из `.env` подхватываются только секреты, через
`${ПЕРЕМЕННАЯ:-дефолт}` — поэтому стек поднимется и вовсе без `.env`, просто без
доступа к LLM.

Письма наружу не уходят: код подтверждения при входе смотрите в Mailpit.

### Только инфраструктура

Если бэк удобнее гонять на хосте (`npm run dev` с автоперезагрузкой) — поднимите
зависимости без `api`, все порты уже проброшены на localhost:

```sh
docker compose up -d mongo qdrant minio minio-init mailpit
npm ci && npm run dev
```

Для этого варианта в `.env` нужны локальные адреса:

```
MONGODB_URI=mongodb://localhost:27017/r-accelerator
QDRANT_URL=http://localhost:6333
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=rocketmind
S3_FORCE_PATH_STYLE=true
EMAIL_HOST=localhost
EMAIL_PORT=1025
```

`QDRANT_API_KEY` оставьте **пустым**: локальный Qdrant работает без ключа, а
непустое значение заставит клиент слать заголовок `api-key` и ругаться на
незащищённое соединение.

### Полезное

```sh
docker compose logs -f api          # логи бэка
docker compose up -d --build api    # пересобрать после правок кода
docker compose down                 # остановить
docker compose down -v              # остановить и стереть данные (Mongo, Qdrant, файлы)
```

Смена `EMBEDDING_MODEL`/`EMBEDDING_DIM` требует пересоздания коллекций Qdrant —
размерность фиксируется при создании. Локально это `docker compose down -v`.

## Диагностика LLM

`GET /api/v1/system/llm-health` — право `system_diagnostics.read` (у суперадмина
есть по умолчанию). Те же проверки прогоняются на старте сервера и пишутся в лог,
не блокируя запуск.

Смысл в том, чтобы **различать причины**: снаружи «агент не отвечает» выглядит
одинаково, а внутри это разные ситуации с разными действиями.

| `status` | Что случилось | Что делать |
|---|---|---|
| `ok` | работает | — |
| `unreachable` | сеть не пустила (DNS/TCP/TLS/таймаут) | смотреть доступ **с сервера** к провайдеру, ключи ни при чём |
| `invalid_key` | ключ отклонён | перевыпустить |
| `no_credits` | деньги кончились | пополнить баланс |
| `rate_limited` | лимит запросов, деньги есть | подождать |
| `misconfigured` | нет такой модели или размерность ≠ `EMBEDDING_DIM` | починить конфиг; при смене размерности — пересоздать коллекции Qdrant и переиндексировать |
| `not_configured` | ключ не задан | задать переменную окружения |

Проверок три, потому что провайдера два и падают они независимо: `chat` (прямой
OpenAI — чат study и акселератора), `openrouterAccount` (ключ и баланс), и
`embeddings` (реальная векторизация со сверкой размерности). Умерший OpenRouter
не трогает study, но полностью останавливает акселератор: сборка контекста
начинается с векторного поиска.

Итоговый `data.status`: `ok` / `degraded` / `down`. HTTP всегда `200` — это отчёт
о состоянии, а не результат операции.

Каждая проверка — реальный сетевой вызов (проба чата стоит доли цента), поэтому
результат кешируется на 60 секунд. Принудительно: `?refresh=true`.

```sh
curl -s localhost:3000/api/v1/system/llm-health -b "accessToken=..." | jq .data.status
```

## Тесты

```sh
npm test
```

Mongo для тестов поднимается in-memory (`mongodb-memory-server`), внешние
сервисы замоканы — Docker для прогона тестов не нужен.

## Деплой

Amvera, Docker-контейнер (`amvera.yml` + `Dockerfile`). Тот же образ, что
собирается локально через `docker compose build api`.

**Про сеть:** `api.openai.com` Amvera проксирует автоматически, а `openrouter.ai`
— нет. Если эмбеддинги падают с `EMBEDDING_PROVIDER_FAILED` и текстом
`Connection error.`, дело не в ключе и не в балансе: с сервера просто не видно
OpenRouter. Лечится обращением в поддержку Amvera с просьбой добавить хост в
проксирование.
