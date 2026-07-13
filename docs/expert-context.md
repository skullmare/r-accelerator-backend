# Экспертный контур: контекст, хранение, сборка LLM-запроса

## Что где хранится

- **MongoDB** — источник истины. Проекты, агенты, экспертные сессии, сообщения,
  артефакты, метаданные файлов (`FileAsset`), краткая сводка проекта
  (`Project.contextSummary`).
- **Qdrant** (коллекция `expert_context`, см. `QDRANT_COLLECTION`) — только
  поисковый векторный индекс. Не бизнес-сущность, не источник истины.
  При расхождении с MongoDB приоритет всегда у MongoDB; Qdrant можно
  переиндексировать из MongoDB и файлов в S3 в любой момент.
- **S3** — бинарные файлы. В LLM-контекст файл попадает только через
  извлечённый и проиндексированный текст (`FileAsset.processingStatus`),
  никогда напрямую.

## Payload точки в Qdrant

```
projectId    string   — обязателен, единственный ключ фильтрации при поиске
agentId      string | null   — строковое представление Agent._id
sourceType   enum     — project_summary | agent_summary | artifact | file_chunk | user_note
sourceId     string   — id исходной сущности в MongoDB
chunkIndex   number
text         string   — фрагмент хранится в payload напрямую (см. docs/open-questions.md)
textHash     string
createdAt    string (ISO)
visibility   enum     — private_project (единственное значение в MVP)
```

Point id — детерминированный UUID v5 от `sourceId:chunkIndex` (см.
`src/services/qdrant.service.js`). Это делает upsert идемпотентным: повторная
индексация того же источника перезаписывает те же точки вместо дублей.

## Поиск

`searchContext({ projectId, sourceTypes, queryText, topK })` в
`src/services/qdrant.service.js` **всегда** требует `projectId` и кидает
ошибку без него — это единственная точка входа в Qdrant и единственное
место, где обеспечивается изоляция между проектами (SEC-6, QDR-3).

## Сборка LLM-запроса (`src/services/accelerator/context-assembly.service.js`)

Порядок сборки системного промпта, полностью на сервере (CTX-1):

1. `Agent.systemPrompt`
2. `Agent.completionCriteria` + описание `Agent.artifactDefinition`
3. `Project.contextSummary`, если `Agent.contextPolicy.includeProjectSummary`
4. Результаты поиска в Qdrant (фильтр `projectId` + `Agent.contextPolicy.allowedSourceTypes`),
   ограниченные `qdrantTopK` и `maxContextChars`

Дальше `src/services/accelerator/expert-session.service.js` добавляет историю
сообщений сессии (до 30 последних) и вызывает `llm.service.chatCompleteStream`
с моделью из `Agent.modelConfig` (провайдер зафиксирован — только OpenAI, см.
`docs/open-questions.md`). Ответ модели стримится клиенту по SSE
(`POST .../expert-sessions/:id/messages`, события `message_created` / `delta`
/ `done` / `error`) — сохраняется в MongoDB только после того, как стрим
полностью завершился, чтобы разрыв соединения на середине не оставил
недописанное сообщение в базе. Генерация артефакта (`/complete`) — отдельный,
не потоковый вызов через `llm.service.chatComplete`: там нужен единый цельный
JSON-ответ для валидации, а не текст, который можно постепенно показывать
пользователю.

## Создание артефакта

Артефакт не парсится из свободного текста чата. По вызову
`POST .../expert-sessions/:id/complete` сервер делает отдельный LLM-вызов с
инструкцией вернуть строго JSON с полями из `artifactDefinition.requiredFields`
(`src/services/accelerator/artifact-generation.service.js`), затем:

1. проверяет наличие всех `requiredFields`;
2. если задан `artifactDefinition.outputSchema`, дополнительно валидирует через
   [ajv](https://ajv.js.org/) — но не роняет создание артефакта, если
   `outputSchema` сам невалиден как JSON Schema (это рабочий инструмент
   администратора, а не production-хранилище схем).

Два прохода завершения (DONE-3..DONE-5):

- без `confirmArtifact` — создаётся `Artifact.status=ready`,
  `ExpertSession.status=waiting_user_confirmation`, `Project.currentAgentId`
  **не меняется**;
- с `confirmArtifact:true` — `Artifact.status=confirmed`, артефакт
  индексируется в Qdrant (`sourceType=artifact`), `Project.contextSummary`
  дополняется его summary, `Project.currentAgentId` переключается на
  `Agent.nextAgentId`.
