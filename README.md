# rocketmind-services

Бэкенд Rocketmind: обучающий контур (`study`) и Р-Акселератор (`accelerator`).

Документация по устройству — в `docs/`:

- `docs/expert-context.md` — сборка контекста агентов, карточка этапа, артефакты;
- `docs/frontend-integration-expert-flow.md` — контракт с фронтом (SSE, кнопки, коды ошибок);
- `docs/data-model.md`, `docs/agents-admin.md`, `docs/file-storage.md` — модель данных, админка, хранилище;
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
