# Модель данных: сущности спринта 3

Источник истины — MongoDB. Полная ER-схема (включая сущности спринта 2):
`docs/architecture/er-diagram.dbml`. Здесь — только новые/расширенные
сущности спринта 3, с типами полей.

## Project (расширение)

| Поле | Тип | Обяз. | Назначение |
|---|---|---|---|
| `currentAgentCode` | string \| null | нет | Код текущего агента маршрута |
| `completedAgentCodes` | string[] | да (default []) | Завершённые агенты |
| `contextSummary` | string \| null | нет | Краткая сводка, добавляемая в каждый LLM-запрос |
| `contextVersion` | number | да (default 0) | Инкрементируется при каждом обновлении summary |
| `qdrantCollection` | string \| null | нет | Переопределение коллекции Qdrant (по умолчанию — `expert_context`) |

## Agent

См. таблицу полей в `docs/agents-admin.md` — тот же набор полей, что и в форме.

## ExpertSession

| Поле | Тип | Обяз. |
|---|---|---|
| `projectId` | ObjectId → Project | да |
| `agentCode` | string | да |
| `status` | enum: draft, active, waiting_user_confirmation, completed, failed | да |
| `inputContextSnapshot` | object | нет — снимок того, что реально ушло в LLM-запрос (audit trail) |
| `outputSummary` | string | нет |
| `artifactId` | ObjectId → Artifact \| null | нет |

## Message

| Поле | Тип | Обяз. |
|---|---|---|
| `sessionId` | ObjectId → ExpertSession | да |
| `projectId` | ObjectId → Project | да |
| `senderType` | enum: user, assistant, system | да |
| `content` | string (≤20000) | да |
| `tokenUsage` | object \| null | нет |

## Artifact

| Поле | Тип | Обяз. |
|---|---|---|
| `projectId` | ObjectId → Project | да |
| `expertSessionId` | ObjectId → ExpertSession | да |
| `agentCode` | string | да |
| `type` | string | да |
| `title` | string | да |
| `content` | object | да |
| `summary` | string (≤4000) | да |
| `status` | enum: draft, ready, confirmed, rejected | да |

## FileAsset (расширение `File`)

| Поле | Тип | Обяз. |
|---|---|---|
| `projectId` | ObjectId → Project \| null | нет |
| `key` | string \| null | нет — ключ объекта в S3, нужен воркеру для `GetObject` |
| `processingStatus` | enum: uploaded, extracting, extracted, indexing, indexed, failed, unsupported | да |
| `extractedTextStatus` | enum: not_started, success, empty, failed, unsupported | да |
| `qdrantStatus` | enum: not_indexed, indexed, failed, stale | да |
| `qdrantPointIds` | string[] | да (default []) |
| `textHash` | string \| null | нет |
| `extractedTextPreview` | string \| null | нет |
| `processingError` | string \| null | нет |
| `indexedAt` | Date \| null | нет |

## Job (внутренняя очередь обработки, не часть публичного API)

| Поле | Тип | Обяз. |
|---|---|---|
| `type` | string | да |
| `payload` | object | нет (default {}) |
| `status` | enum: pending, processing, completed, failed | да |
| `attempts` / `maxAttempts` | number | да |
| `runAt` | Date | да |
| `lastError` | string \| null | нет |

## Qdrant payload

См. `docs/expert-context.md` — таблица `payload.*` там же.
