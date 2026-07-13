# Админ-интерфейс агентов

`POST/GET/PATCH /api/v1/accelerator/admin/agents` — доступ только с правом
`accelerator_agents.manage` (или superadmin, которому назначены все права).
Обычный пользователь получает 403 и не видит `systemPrompt`/`completionCriteria`
ни в одном ответе этих эндпоинтов.

**Важно:** это универсальная сущность. Агент идентифицируется своим `_id`
(Mongo ObjectId) — отдельного человекочитаемого кода нет (см.
`docs/open-questions.md` про это решение). Система не содержит
захардкоженного набора R1–R5 — это только демо-данные
(`scripts/seed-demo-agents.js`) для проверки сквозного сценария.

## Поля формы

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `name` | string | да | Имя для интерфейса |
| `roleTitle` | string | да | Роль/специализация |
| `order` | number | да | Порядок в маршруте |
| `isActive` | boolean | нет (default true) | `false` — временно скрыть агента из пользовательского маршрута |
| `systemPrompt` | string | да | Базовая системная инструкция |
| `completionCriteria` | string | да | Что должно быть выяснено для завершения этапа |
| `artifactDefinition.artifactType` | string | да | Тип артефакта |
| `artifactDefinition.requiredFields` | string[] | нет | Обязательные поля итогового JSON |
| `artifactDefinition.outputSchema` | object | нет | JSON Schema для доп. валидации (ajv); при невалидной схеме проверка полей всё равно выполняется |
| `artifactDefinition.summaryField` | string | нет (default `summary`) | Какое поле артефакта использовать как краткую сводку |
| `nextAgentId` | ObjectId \| null | нет | `_id` следующего агента; должен существовать или быть пустым — проверяется на сервере |
| `contextPolicy.qdrantTopK` | number | нет (default 6) | Сколько фрагментов подтягивать из Qdrant |
| `contextPolicy.maxContextChars` | number | нет (default 6000) | Лимит символов на retrieved-контекст |
| `contextPolicy.allowedSourceTypes` | string[] | нет | Какие sourceType участвуют в поиске |
| `modelConfig.provider` | `openai` \| `openrouter` | нет (default openai) | Провайдер LLM |
| `modelConfig.model` | string | нет | Модель провайдера |

В UI связывание агентов друг с другом (`nextAgentId`) должно делаться через
выпадающий список, заполненный из `GET /accelerator/admin/agents` (там уже
есть `_id` и `name` каждого агента) — админ выбирает следующего агента по
имени, а на сервер уходит его `_id`. Ему никогда не нужно вручную вводить
или запоминать ObjectId.

## Проверки на сервере

- `nextAgentId`, если задан, должен ссылаться на существующего агента
  (400 `AGENT_NOT_FOUND` иначе).
- `isActive=false` не удаляет агента — он просто не участвует в маршруте
  пользователя и не может быть выбран как "текущий" (см.
  `resolveCurrentAgent` в `src/services/accelerator/expert-session.service.js`).

## Почему нет отдельного `code`

Изначально был отдельный человекочитаемый `code` (`"R1"`, `"R2"`), используемый
как ссылка вместо `_id`. От него отказались: `code` был редактируемым полем,
и переименование агента ломало все ссылки на него (`nextAgentId` у других
агентов, `Project.currentAgentId`, уже созданные `ExpertSession`/`Artifact`,
`payload.agentId` в Qdrant) — на практике это давало риск дребезжащих
(dangling) ссылок без каскадного обновления. `_id` неизменяем по своей
природе, этой проблемы не существует. Подробности компромисса — в
`docs/open-questions.md`.
