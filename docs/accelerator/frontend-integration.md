# Интеграция Акселератора: руководство для фронтенда

Всё, что нужно, чтобы собрать экран проекта и чат с агентом. Базовый путь —
`/api/v1`. Авторизация — httpOnly-кука `accessToken` (запросы отправляем с
`credentials: 'include'`).

Формат ответов одинаков для всех эндпоинтов:

```jsonc
// успех
{ "success": true, "message": "Этап завершён", "data": { /* ... */ } }
// ошибка
{ "success": false, "message": "Этап уже завершён", "error": { "code": "SESSION_ALREADY_COMPLETED" } }
```

---

## 1. Сценарий целиком

```
POST /accelerator/projects                       → создали проект
GET  /accelerator/projects/:id/expert-route      → нарисовали шкалу этапов
POST /accelerator/projects/:id/expert-sessions   → открыли/продолжили сессию
GET  .../expert-sessions/:sid/messages           → восстановили диалог
POST .../expert-sessions/:sid/messages (SSE)     → переписка, N раз
   … приходит readyForArtifact: true             → показали кнопку
POST .../expert-sessions/:sid/complete           → документ + переход дальше
   → nextAgentId !== null → возвращаемся к POST expert-sessions
   → nextAgentId === null → маршрут пройден, показываем итоги проекта
```

## 2. Проект

**`POST /accelerator/projects`**

```json
{ "name": "Логистический стартап", "description": "…", "stage": "idea", "goal": "…" }
```

Обязательно только `name`. Остальные поля (`description`, `userRole`,
`industry`, `businessSpecifics`, `stage`, `goal`) — необязательные.
`stage`: `idea | mvp | launched | growth | scale`.

Полезные поля ответа:

| Поле | Значение |
|---|---|
| `currentAgentId` | Текущий агент. `null` у нового проекта — проставится при первом обращении к маршруту |
| `completedAgentIds` | Пройденные этапы |
| `status` | `active / paused / completed / archived`. `completed` выставляется сервером сам, когда пройден последний агент |
| `contextSummary` | Накопленная сводка по проекту (можно показывать как «что мы уже знаем») |

Ещё есть `GET /accelerator/projects` (список), `GET /:projectId`,
`PATCH /:projectId`.

## 3. Маршрут агентов

**`GET /accelerator/projects/:projectId/expert-route`**

```jsonc
{
  "currentAgentId": "6650…b21",
  "items": [
    { "_id": "6650…b20", "name": "Роман", "description": "Эксперт по рынку",
      "avatarUrl": "…", "thinkingAvatarUrl": "…", "order": 1, "status": "completed" },
    { "_id": "6650…b21", "name": "Регина", "description": "Эксперт по аудитории",
      "avatarUrl": "…", "thinkingAvatarUrl": "…", "order": 2, "status": "current" },
    { "_id": "6650…b22", "name": "Тимур", "description": null,
      "avatarUrl": null, "thinkingAvatarUrl": null, "order": 3, "status": "locked" }
  ]
}
```

`status`: `completed` (пройден) / `current` (активен) / `locked` (ещё не
дошли). Промпты агентов сюда не попадают — только отображаемые поля.

`currentAgentId: null` означает, что маршрут пройден целиком.

## 4. Сессия

**`POST /accelerator/projects/:projectId/expert-sessions`** — тело можно не
передавать.

```jsonc
{
  "session": {
    "_id": "6651…a01",
    "agentId": "6650…b20",
    "status": "active",
    "collectedData": {},
    "readyForArtifact": false,
    "artifactId": null
  },
  "agent": { "_id": "6650…b20", "name": "Роман", "description": "Эксперт по рынку",
             "avatarUrl": "…", "thinkingAvatarUrl": "…", "order": 1 }
}
```

Эндпоинт идемпотентен: если активная сессия с текущим агентом уже есть,
вернётся она же. Поэтому его безопасно дёргать при каждом входе в проект — и
именно так и нужно делать, отдельного «продолжить сессию» не требуется.

Можно передать `{ "agentId": "…" }` — тогда сервер проверит, что это
действительно текущий агент, и вернёт `409 AGENT_NOT_CURRENT`, если фронт
отстал от состояния проекта.

## 5. Восстановление экрана

**`GET /accelerator/projects/:projectId/expert-sessions/:sessionId/messages`**

```jsonc
{
  "items": [
    { "_id": "…", "senderType": "user",      "content": "Привет", "createdAt": "…" },
    { "_id": "…", "senderType": "assistant", "content": "Здравствуйте! …", "createdAt": "…" }
  ],
  "collectedData": { "market": "Рынок логистики растёт", "niche": "B2B SaaS" },
  "readyForArtifact": true,
  "artifactId": null,
  "status": "active"
}
```

Одного запроса достаточно, чтобы после перезагрузки страницы восстановить и
диалог, и состояние кнопки завершения этапа.

## 6. Отправка сообщения (SSE)

**`POST /accelerator/projects/:projectId/expert-sessions/:sessionId/messages`**

```json
{ "content": "Мы делаем сервис для логистики" }
```

Ответ — поток `text/event-stream`. Ошибки, известные до обращения к модели
(сессия не найдена, этап уже завершён), приходят обычным JSON — проверяйте
`Content-Type` перед тем, как читать поток.

| Событие | Данные | Что делать |
|---|---|---|
| `message_created` | `{ userMessage }` | Заменить оптимистичное сообщение пользователя на сохранённое |
| `delta` | `{ text }` | Дописывать в пузырь ответа. Пока идут `delta`, показываем `thinkingAvatarUrl` |
| `data_updated` | `{ collectedData, readyForArtifact }` | Обновить панель собранных данных. Может прийти в середине хода |
| `done` | `{ assistantMessage, collectedData, readyForArtifact }` | Зафиксировать финальное сообщение и состояние |
| `error` | `{ message, code }` | Показать ошибку, оставить возможность повторить |

Событие `error` приходит **внутри потока** со статусом 200 — обрабатывайте его
наравне с HTTP-ошибками. `code` нормализован: если у ошибки провайдера не было
своего кода, придёт `LLM_PROVIDER_FAILED`.

Пример чтения через `fetch` (EventSource не подойдёт — нужен POST):

```js
const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content })
});

if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error((await res.json()).message);
}

const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
let buffer = '';

while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop();                       // хвост без \n\n — ждём остаток

    for (const block of blocks) {
        const event = block.match(/^event: (.+)$/m)?.[1];
        const data = JSON.parse(block.match(/^data: (.+)$/m)[1]);

        if (event === 'delta') appendToBubble(data.text);
        if (event === 'data_updated') setStageState(data);
        if (event === 'done') finishTurn(data);
        if (event === 'error') showError(data);
    }
}
```

## 7. Кнопка «Сформировать документ»

Показывайте её, когда `readyForArtifact === true` (приходит в `done`,
`data_updated` и в `GET .../messages`). Это значит, что агент сам счёл этап
собранным.

Сервер завершение **не блокирует**: если дать пользователю завершить этап
раньше (например, кнопкой «Завершить досрочно»), документ будет создан по уже
собранным данным. Ошибки «этап не готов» не существует.

## 8. Завершение этапа

**`POST /accelerator/projects/:projectId/expert-sessions/:sessionId/complete`** —
без тела.

```jsonc
{
  "artifact": {
    "_id": "6652…c11",
    "title": "Роман: итоги этапа",
    "documentMarkdown": "## Рынок\n\n…",
    "summary": "- market: Рынок логистики растёт\n- niche: B2B SaaS",
    "file": {
      "url": "https://s3…/roman-itogi-etapa.pdf",
      "mimeType": "application/pdf",
      "size": 84213
    }
  },
  "nextAgentId": "6650…b21",
  "projectContextVersion": 1
}
```

Что делать с ответом:

- `artifact.file.url` — ссылка на PDF: показать в просмотрщике и дать скачать;
- `artifact.documentMarkdown` — можно отрендерить документ прямо в интерфейсе,
  не открывая PDF;
- `nextAgentId !== null` → открыть сессию со следующим агентом
  (`POST .../expert-sessions`), после чего перерисовать шкалу маршрута;
- `nextAgentId === null` → маршрут пройден, проект получил
  `status: "completed"` — показываем экран итогов.

Вызов **долгий** (генерация документа + вёрстка PDF + загрузка в S3): держите
кнопку в состоянии загрузки и не ставьте таймаут меньше 60 секунд.

Повторный вызов на завершённой сессии безопасен — вернётся тот же документ, а
не ошибка. Двойной клик ничего не сломает.

## 9. Документы проекта

**`GET /accelerator/projects/:projectId/artifacts`**

```jsonc
{ "items": [ { "_id": "…", "agentId": "…", "title": "…", "summary": "…", "file": { "url": "…" } } ] }
```

По одному документу на пройденный этап, в порядке создания. Удобно для панели
результатов проекта.

## 10. Коды ошибок

| HTTP | `error.code` | Когда | Что показать |
|---|---|---|---|
| 401 | — | Нет/просрочена кука | Перелогин |
| 403 | — | Проект не принадлежит пользователю | «Нет доступа» |
| 404 | `SESSION_NOT_FOUND` | Сессия не найдена | Открыть сессию заново |
| 404 | `AGENT_NOT_FOUND` | Агент сессии удалён | Обновить маршрут, открыть сессию заново |
| 409 | `AGENT_NOT_CURRENT` | Фронт отстал от состояния проекта | Перезапросить `expert-route` |
| 409 | `NO_CURRENT_AGENT` | Маршрут пройден или агенты не заведены | Экран итогов / «сервис ещё настраивается» |
| 409 | `SESSION_ALREADY_COMPLETED` | Пишем в завершённую сессию | Открыть сессию со следующим агентом |
| 502 | `LLM_PROVIDER_FAILED` | Сбой модели | «Попробуйте ещё раз» + retry |
| 502 | `ARTIFACT_RENDER_FAILED` / `ARTIFACT_UPLOAD_FAILED` | Сбой вёрстки PDF или хранилища | «Не удалось сформировать документ» + retry |

Все они восстановимы повтором действия — тупиковых состояний в пайплайне нет.

## 11. Что изменилось по сравнению с прошлой версией API

Если вы интегрировались раньше — вот полный список ломающих изменений.

| Было | Стало |
|---|---|
| `POST .../complete` дважды: черновик + `confirmArtifact: true` | Один вызов без тела |
| `regenerate: true` для перегенерации черновика | Убрано |
| `completionState { ready, missingFields, reason }` | `readyForArtifact: boolean` |
| SSE-событие `fields_updated` с `collectedFields` | Событие `data_updated` с `collectedData` |
| `collectedFields[key] = { value, quote, sourceMessageId }` | `collectedData[key] = "значение"` (плоская строка) |
| `409 STAGE_NOT_READY` при досрочном завершении | Ошибки нет — этап завершается всегда |
| `422 ARTIFACT_VALIDATION_FAILED` | Ошибки нет — JSON-схем артефакта больше не существует |
| `502 QDRANT_INDEX_FAILED` | Ошибки нет — сбой индексации не прерывает этап |
| `409 NEXT_AGENT_UNAVAILABLE` | Ошибки нет — маршрут продолжается по `order` |
| `409 AGENT_INACTIVE` | Ошибки нет — поля `isActive` больше нет |
| `agentId` обязателен в `POST .../expert-sessions` | Необязателен |
| `artifact.status` (`ready`/`confirmed`), `artifact.content`, `artifact.type` | Убраны: документ всегда финальный |
| `session.status`: `draft`/`waiting_user_confirmation`/`failed` | Только `active` и `completed` |
| У агента `roleTitle`, `greeting` | `description` (подпись) — `greeting` больше нет; приветствие пишите в интерфейсе или первым сообщением агента |
