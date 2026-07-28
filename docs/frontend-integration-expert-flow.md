# Интеграция фронта с экспертным контуром: переключение агентов и артефакты

> Гайд для фронтенд-разработчика. Покрывает главный сценарий Р-Акселератора:
> диалог с агентом → кнопка «сформировать артефакт» → PDF-черновик →
> подтверждение → переключение на следующего агента. Все JSON-примеры сняты с
> реального формата ответов бэка (обёртка resify-express), не из головы.

---

## 0. Главный принцип: состоянием владеет сервер

Фронт **ничего не решает** про маршрут и готовность этапа — он только
отражает то, что сказал бэк, и дёргает эндпоинты в правильном порядке:

- кто текущий агент — говорит `GET /expert-route` (`currentAgentId`);
- можно ли показывать кнопку «сформировать артефакт» — говорит
  `completionState.ready` (приходит в SSE и в истории сообщений);
- когда произошло переключение агента — говорит ответ `/complete` с
  `confirmed: true`.

Любая попытка «срезать» (создать сессию не с тем агентом, завершить неготовый
этап, написать в завершённую сессию) вернёт 4xx с машиночитаемым `code` —
это штатная часть протокола, обрабатывайте их как состояния UI, а не как
"что-то сломалось".

## 1. Общие условия

- **База:** `/api/v1/accelerator`
- **Авторизация:** cookie-сессия → каждый запрос с `credentials: 'include'`.
- **Обёртка успеха:** `{ "success": true, "message": "...", "data": {...} }`
- **Обёртка ошибки:** `{ "success": false, "message": "...", "error": { "code": "...", ... } }`
  Всегда сначала смотрите `error.code`, `message` — человекочитаемый текст,
  который можно показывать пользователю как есть (он по-русски).

---

## 2. Полный сценарий по шагам

### Шаг 1. Узнать текущего агента

```
GET /api/v1/accelerator/projects/{projectId}/expert-route
```

```json
{
  "success": true,
  "data": {
    "currentAgentId": "665f01...",
    "items": [
      { "_id": "665f01...", "name": "Роман",  "status": "current",   "nextAgentId": "665f02..." },
      { "_id": "665f02...", "name": "Регина", "status": "locked",    "nextAgentId": null }
    ]
  }
}
```

- `status` каждого пункта: `completed` / `current` / `locked` — готовая
  раскраска степпера маршрута.
- `currentAgentId: null` **у проекта, который уже проходил этапы** = маршрут
  полностью завершён. Показывайте финальный экран, кнопок диалога нет.
  (Для свежего проекта null не приходит — сервер сам подставит первого агента.)

### Шаг 2. Создать/получить сессию

```
POST /api/v1/accelerator/projects/{projectId}/expert-sessions
Body: { "agentId": "<currentAgentId из шага 1>" }
```

Ответ `201`: `{ "data": { "session": { "_id", "status", "artifactId", "completionState", ... } } }`

- Эндпоинт **идемпотентный по смыслу**: если незакрытая сессия с этим агентом
  уже есть — вернётся она же, дубликат не создастся. Смело вызывайте при
  каждом входе на экран агента.
- Передавать можно **только** `currentAgentId`. Любой другой агент →
  `409 AGENT_NOT_CURRENT`. Если поймали — ваш стейт устарел, перечитайте
  `/expert-route`.
- Обратите внимание на поля сессии: `artifactId != null` + статус
  `waiting_user_confirmation` значит, что черновик артефакта уже был создан
  ранее — сразу показывайте экран подтверждения (шаг 5), а не пустой чат.

### Шаг 3. Восстановить историю (при открытии экрана)

```
GET /api/v1/accelerator/projects/{projectId}/expert-sessions/{sessionId}/messages
```

```json
{
  "data": {
    "items": [ { "senderType": "user", "content": "..." }, { "senderType": "assistant", "content": "..." } ],
    "completionState": { "ready": false, "missingFields": ["risks"], "reason": "...", "evaluatedAt": "..." },
    "artifactId": null,
    "status": "active"
  }
}
```

Здесь же приходит `completionState` — восстановите состояние кнопки
«сформировать артефакт» без единого лишнего запроса.

### Шаг 4. Диалог — POST + SSE (не EventSource!)

```
POST /api/v1/accelerator/projects/{projectId}/expert-sessions/{sessionId}/messages
Body: { "content": "текст пользователя" }
```

⚠️ **Это POST со стримом в ответе.** Браузерный `EventSource` умеет только
GET — он здесь **не подойдёт**. Читайте через `fetch` + `ReadableStream`:

```js
async function sendMessage(projectId, sessionId, content, handlers) {
  const res = await fetch(
    `/api/v1/accelerator/projects/${projectId}/expert-sessions/${sessionId}/messages`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  );

  // Ошибки, известные ДО старта стрима (сессия завершена, не найдена),
  // приходят обычным JSON с соответствующим статусом — стрима не будет.
  if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    const body = await res.json();
    throw Object.assign(new Error(body.message), { code: body.error?.code, status: res.status });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // события разделены пустой строкой: "event: X\ndata: {...}\n\n"
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = block.match(/^event: (.+)$/m)?.[1];
      const data = block.match(/^data: (.+)$/m)?.[1];
      if (event && data) handlers[event]?.(JSON.parse(data));
    }
  }
}
```

**События и что с ними делать:**

| Событие | Payload | Действие UI |
|---|---|---|
| `message_created` | `{ userMessage }` | Заменить оптимистично отрисованное сообщение пользователя на серверное (с `_id`). |
| `delta` | `{ text }` | Дописывать текст в пузырь ответа агента (стриминг). |
| `done` | `{ assistantMessage, completionState }` | Зафиксировать сообщение агента. **Обновить состояние кнопки по `completionState`** — см. §3. |
| `error` | `{ message, code }` | Показать ошибку в чате (обычно `LLM_PROVIDER_FAILED`). Сообщение пользователя при этом уже сохранено. |
| `evaluation_error` | `{ message, code }` | Не показывать пользователю как ошибку чата! Ответ агента доставлен нормально, просто оценка готовности не пересчиталась — `completionState` в `done` может быть от прошлого хода. Кнопку не трогайте. |

### Шаг 5. Черновик артефакта (первая фаза `/complete`)

Показываете кнопку только при `completionState.ready === true`. По клику:

```
POST /api/v1/accelerator/projects/{projectId}/expert-sessions/{sessionId}/complete
Body: {}            ← без confirmArtifact!
```

Успех `200`:

```json
{
  "data": {
    "artifact": {
      "_id": "...",
      "title": "Рыночный бриф",
      "status": "ready",
      "file": { "url": "https://s3.../xxx.pdf", "mimeType": "application/pdf", "size": 18484 },
      "documentMarkdown": "## Рынок\n...",
      "summary": "..."
    },
    "nextAgentId": null,
    "confirmed": false
  }
}
```

- **`artifact.file.url` — это готовый PDF.** Показывайте его пользователю
  (embed/iframe/кнопка «открыть») **до** подтверждения — весь смысл двухфазки
  в том, что человек подтверждает то, что увидел.
- `nextAgentId: null` здесь **не значит** «маршрут кончился» — в черновой
  фазе он null всегда. Смотрите на `confirmed: false`.
- Запрос долгий (два LLM-вызова + рендер + S3): **дизейблите кнопку и
  показывайте прогресс**, защититесь от даблкликов.

**Если этап не готов**, а `/complete` всё же вызвали (гонка, устаревший стейт):

```json
// HTTP 409
{
  "success": false,
  "message": "Этап ещё не готов к формированию артефакта: собраны не все необходимые данные",
  "error": {
    "code": "STAGE_NOT_READY",
    "missingFields": ["competitors", "risks"],
    "reason": "Не собраны конкуренты и риски."
  }
}
```

Покажите `reason` и список недостающего — это готовый текст для пользователя
(«чтобы завершить этап, обсудите с агентом: …»).

### Шаг 6 (опционально). Перегенерация черновика

Пользователю не понравился документ → кнопка «сгенерировать заново»:

```
POST .../complete
Body: { "regenerate": true }
```

Вернётся новый `artifact` (новый `_id`, новый PDF), старый помечается
`rejected`. Для уже подтверждённого артефакта — `409 ARTIFACT_ALREADY_CONFIRMED`
(но по-хорошему кнопки «заново» на подтверждённом экране быть не должно).

### Шаг 7. Подтверждение — ЗДЕСЬ происходит переключение агента

```
POST .../complete
Body: { "confirmArtifact": true }
```

Успех `200`:

```json
{
  "data": {
    "artifact": { "_id": "...", "status": "confirmed", "file": { "url": "..." } },
    "nextAgentId": "665f02...",      // ← кто теперь текущий агент (или null)
    "projectContextVersion": 3,
    "confirmed": true
  }
}
```

**Что обязан сделать фронт после `confirmed: true`:**

1. `nextAgentId != null` → маршрут продолжается:
   - перечитать `GET /expert-route` (обновить степпер);
   - создать **новую** сессию (`POST /expert-sessions` с `nextAgentId`) —
     старая сессия теперь `completed`, писать в неё нельзя
     (`409 SESSION_ALREADY_COMPLETED`);
   - открыть чистый чат нового агента (у него свои `greeting`/`avatarUrl` —
     берите из данных маршрута/агента).
2. `nextAgentId === null` → **весь маршрут завершён**: проект перешёл в
   `completed`. Показывайте финальный экран (список артефактов —
   `GET /projects/{id}/artifacts`, у каждого свой `file.url`).

**Возможные ошибки подтверждения:**

- `409 NEXT_AGENT_UNAVAILABLE` — маршрут повреждён на стороне админки
  (следующий агент удалён). Артефакт **не потерян** (остался `ready`),
  ничего не переключилось. Показывайте `message` как есть и оставьте
  пользователя на экране подтверждения — после починки маршрута повторный
  клик по «подтвердить» сработает.
- `502 QDRANT_INDEX_FAILED` — артефакт уже `confirmed`, но индексация упала
  и **переключения не произошло**. Корректное поведение: показать ошибку и
  предложить повторить — повторный `/complete {confirmArtifact:true}`
  безопасен (артефакт не пересоздаётся, просто повторится индексация и
  переключение).

---

## 3. `completionState` — контракт кнопки «сформировать артефакт»

```ts
type CompletionState = {
  ready: boolean;            // true → кнопку показываем
  missingFields: string[];   // чего не хватает (имена полей артефакта)
  reason: string | null;     // человекочитаемое пояснение оценщика
  evaluatedAt: string | null;        // null → оценка ещё не выполнялась
  evaluatedAfterMessageId: string | null;
};
```

Правила:

- **Источники**: SSE-событие `done` (после каждого ответа агента) и
  `GET .../messages` (при открытии экрана). Отдельного эндпоинта «проверь
  готовность» нет и не нужно.
- `ready: false` — кнопку скрыть/задизейблить; хорошая практика — показать
  подсказку из `reason` («агент ещё собирает: конкуренты, риски»).
- `ready: true` — показать кнопку. Но всё равно обрабатывайте
  `STAGE_NOT_READY` на `/complete`: если пользователь дописал сообщение после
  оценки, сервер пересчитает готовность заново и может отказать.
- Пришло `evaluation_error` — состояние кнопки **не менять** (оно от
  прошлого хода), это не ошибка диалога.

---

## 4. Машина состояний экрана (сводка)

```
                 ┌──────────────────────────────────────────────┐
                 ▼                                              │
GET /expert-route ──► currentAgentId=null и есть completed ──► ФИНАЛЬНЫЙ ЭКРАН
        │                                                (список артефактов)
        ▼
POST /expert-sessions {agentId: current}
        │
        ▼
session.status=waiting_user_confirmation? ──да──► ЭКРАН ПОДТВЕРЖДЕНИЯ (PDF)
        │нет                                        │  ▲
        ▼                                           │  │ {regenerate:true}
      ЧАТ ◄─────────────────────────────┐           │  │ (новый PDF)
        │ POST messages (SSE)           │           │  │
        ▼                               │           │  │
   done.completionState.ready?          │           │  │
        │false → чат дальше ────────────┘           │  │
        │true → кнопка «сформировать артефакт»      │  │
        ▼                                           │  │
POST /complete {} ──► artifact.file.url ──► ЭКРАН ПОДТВЕРЖДЕНИЯ
                                                    │
                                    POST /complete {confirmArtifact:true}
                                                    │
                              confirmed:true, nextAgentId ──┬── != null → в начало
                                                            └── null → ФИНАЛЬНЫЙ ЭКРАН
```

---

## 5. Полная таблица ошибок → реакция UI

| HTTP | `error.code` | Где | Что делать в UI |
|---|---|---|---|
| 409 | `AGENT_NOT_CURRENT` | создание сессии | Стейт устарел — перечитать `/expert-route` и открыть актуального агента. |
| 409 | `AGENT_INACTIVE` | создание сессии | «Агент временно отключён» — показать message, дальше не пускать. |
| 404 | `AGENT_NOT_FOUND` / `SESSION_NOT_FOUND` | везде | Перечитать маршрут/сессию; вероятно, битая ссылка или удалённая сущность. |
| 409 | `SESSION_ALREADY_COMPLETED` | сообщения, `/complete` | Сессия закрыта — перечитать `/expert-route`, перейти к текущему агенту. Классический симптом «фронт не создал новую сессию после подтверждения». |
| 409 | `STAGE_NOT_READY` | `/complete` | Показать `reason` + `missingFields`, вернуть в чат. Кнопку скрыть до нового `ready:true`. |
| 409 | `ARTIFACT_ALREADY_CONFIRMED` | `/complete {regenerate}` | Артефакт финален — убрать кнопку «заново». |
| 409 | `NEXT_AGENT_UNAVAILABLE` | `/complete {confirm}` | Маршрут сломан админкой; артефакт цел. Показать message, оставить экран подтверждения, повторный клик после починки сработает. |
| 422 | `ARTIFACT_VALIDATION_FAILED` | `/complete` | Модель выдала кривую структуру. Предложить «попробовать ещё раз» (повторный `/complete` или `{regenerate:true}`). |
| 502 | `LLM_PROVIDER_FAILED` | SSE `error`, `/complete` | Сбой провайдера — «попробуйте ещё раз». Не путать с 422. |
| 502 | `COMPLETION_EVALUATION_FAILED` | `/complete` | Оценка готовности не удалась — «попробуйте ещё раз». |
| 502 | `ARTIFACT_RENDER_FAILED` / `ARTIFACT_UPLOAD_FAILED` | `/complete` | Документ/файл не собрался — повторный `/complete` сгенерирует заново. |
| 502 | `QDRANT_INDEX_FAILED` | `/complete {confirm}` | Повторить подтверждение — безопасно, см. §2 шаг 7. |
| — | (SSE `evaluation_error`) | сообщения | НЕ ошибка чата. Кнопку не трогать, ничего страшного не случилось. |

---

## 6. Чеклист типовых ошибок интеграции

Именно эти пункты давали симптомы «агенты не переключаются / артефакт не создаётся»:

- [ ] После `confirmed: true` фронт **перечитывает** `/expert-route` и
      **создаёт новую сессию** — не продолжает писать в старую.
- [ ] `/complete` вызывается **дважды**: сначала `{}` (черновик), потом
      `{confirmArtifact: true}`. Одна фаза без другой = «ничего не работает».
- [ ] Кнопка появляется по `completionState.ready`, а не всегда/никогда.
- [ ] SSE читается через `fetch`+stream (POST!), обрабатываются **все пять**
      событий, включая `error` и `evaluation_error`.
- [ ] `nextAgentId: null` при `confirmed: false` не трактуется как «конец
      маршрута» (в черновой фазе он null всегда).
- [ ] На время `/complete` кнопка задизейблена (защита от даблклика);
      запрос может идти 10–30 секунд.
- [ ] PDF берётся из `artifact.file.url` и показывается **до** подтверждения.
- [ ] 4xx-коды из таблицы обрабатываются как состояния UI, а не как toast
      «Ошибка сервера».
