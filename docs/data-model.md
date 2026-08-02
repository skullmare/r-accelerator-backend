# Модель данных: Акселератор

Источник истины — MongoDB. Полная ER-схема (включая сущности обучающего
контура): `docs/architecture/er-diagram.dbml`. Как эти сущности работают
вместе — `docs/accelerator/README.md`.

## Project (поля маршрута)

| Поле | Тип | Обяз. | Назначение |
|---|---|---|---|
| `currentAgentId` | ObjectId → Agent \| null | нет | Текущий агент маршрута; `null` после его прохождения |
| `completedAgentIds` | ObjectId[] → Agent | да (default []) | Завершённые этапы |
| `contextSummary` | string \| null | нет | Накопленная сводка, подмешивается в промпт каждого агента |
| `contextVersion` | number | да (default 0) | Инкрементируется при каждом обновлении сводки |

## Agent

| Поле | Тип | Обяз. | Назначение |
|---|---|---|---|
| `systemPrompt` | string (≤20000) | да | Основная инструкция агента |
| `completionPrompt` | string (≤5000) | да | Условие завершения этапа, текстом |
| `name` | string (≤150) | да | Имя для интерфейса |
| `order` | number | да | Место в маршруте |
| `knowledgeIds` | ObjectId[] → Knowledge | нет (default []) | Закреплённые базы знаний |
| `description` | string (≤1000) \| null | нет | Описание для интерфейса и подзаголовок PDF |
| `avatarUrl` / `thinkingAvatarUrl` | string (≤2000) \| null | нет | Аватарки для интерфейса |
| `nextAgentId` | ObjectId → Agent \| null | нет | Переопределение перехода (по умолчанию — следующий по `order`) |

Подробно про заполнение — `docs/accelerator/agent-setup.md`.

## ExpertSession

| Поле | Тип | Обяз. |
|---|---|---|
| `projectId` | ObjectId → Project | да |
| `agentId` | ObjectId → Agent | да |
| `status` | enum: active, completed | да |
| `collectedData` | Map<string, string> | да (default {}) — данные, собранные агентом в диалоге |
| `readyForArtifact` | boolean | да (default false) — агент счёл условие завершения выполненным |
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
| `agentId` | ObjectId → Agent | да |
| `title` | string (≤300) | да |
| `documentMarkdown` | string | да — исходник документа, из которого свёрстан PDF |
| `summary` | string (≤4000) | да — сводка этапа, уходит в `Project.contextSummary` |
| `file` | object | да — `{ key, url, mimeType, size }`, PDF в S3 |

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

## Knowledge

Глобальная база знаний, привязывается к агентам через `Agent.knowledgeIds`.
Поля — в `src/models/accelerator/knowledge.model.js`; индексируется в отдельную
Qdrant-коллекцию `knowledge_context` с фильтром по `knowledgeId`.

## Qdrant

Две коллекции: `expert_context` (приватный контекст проекта, все точки
фильтруются по `projectId`) и `knowledge_context` (глобальные базы знаний,
фильтр по `knowledgeId`). Payload хранит сам текст фрагмента — см.
`src/services/qdrant.service.js`.
