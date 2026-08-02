/**
 * @swagger
 * components:
 *   schemas:
 *     ExpertSession:
 *       type: object
 *       description: Диалог пользователя с одним агентом на одном этапе маршрута.
 *       properties:
 *         _id:
 *           type: string
 *         projectId:
 *           type: string
 *         agentId:
 *           type: string
 *           description: Агент этой сессии. Сессия всегда открывается с текущим агентом проекта — перепрыгнуть этап нельзя.
 *         status:
 *           type: string
 *           enum: [active, completed]
 *           description: active — диалог идёт; completed — этап завершён, документ создан, проект переключён на следующего агента.
 *         collectedData:
 *           type: object
 *           additionalProperties: { type: string }
 *           description: |
 *             Данные, собранные агентом в диалоге, — простой словарь «ключ:
 *             значение». Ключи агент придумывает сам по своему промпту, схемы
 *             и обязательных полей нет. Из этих данных формируется документ
 *             этапа и сводка для следующего агента.
 *         readyForArtifact:
 *           type: boolean
 *           description: |
 *             Агент подтвердил, что условие завершения (completionPrompt)
 *             выполнено. По этому флагу фронт показывает кнопку «Сформировать
 *             документ». Сервер завершение не блокирует — флаг подсказывает
 *             момент, а не запрещает действие.
 *         artifactId:
 *           type: string
 *           nullable: true
 *           description: Документ, созданный при завершении этапа.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ExpertMessage:
 *       type: object
 *       description: Одна реплика в диалоге (домен Акселератора — отдельный от StudyMessage обучающих курсов).
 *       properties:
 *         _id:
 *           type: string
 *         sessionId:
 *           type: string
 *         projectId:
 *           type: string
 *         senderType:
 *           type: string
 *           enum: [user, assistant, system]
 *           description: Кто автор сообщения. system зарезервирован на будущее, сейчас не создаётся автоматически.
 *         content:
 *           type: string
 *         tokenUsage:
 *           type: object
 *           nullable: true
 *           description: Статистика по токенам от провайдера, если он её вернул (только для ответов агента) — для аудита расходов, на логику не влияет.
 *         createdAt:
 *           type: string
 *           format: date-time
 *     ExpertArtifact:
 *       type: object
 *       description: Итоговый документ этапа. Для пользователя это PDF (file.url), для следующих агентов — summary и текст документа (индексируется в Qdrant).
 *       properties:
 *         _id:
 *           type: string
 *         projectId:
 *           type: string
 *         expertSessionId:
 *           type: string
 *         agentId:
 *           type: string
 *         title:
 *           type: string
 *           description: Заголовок документа — собирается из имени агента.
 *         documentMarkdown:
 *           type: string
 *           description: Исходник документа в Markdown, из которого свёрстан PDF.
 *         summary:
 *           type: string
 *           description: Краткая сводка этапа (собранные данные) — уходит в Project.contextSummary следующему агенту.
 *         file:
 *           type: object
 *           description: Сгенерированный PDF в S3 — основной результат этапа для пользователя.
 *           properties:
 *             key: { type: string, nullable: true }
 *             url: { type: string, nullable: true, description: "Ссылка на PDF — её фронт показывает пользователю." }
 *             mimeType: { type: string }
 *             size: { type: integer, nullable: true }
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ExpertRouteAgent:
 *       type: object
 *       description: Публичное представление агента — то, что отдаётся обычному пользователю. Промпты и знания сюда не попадают.
 *       properties:
 *         _id: { type: string }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         avatarUrl: { type: string, nullable: true }
 *         thinkingAvatarUrl: { type: string, nullable: true }
 *         order: { type: integer }
 *     ExpertRouteItem:
 *       allOf:
 *         - $ref: '#/components/schemas/ExpertRouteAgent'
 *         - type: object
 *           description: Агент маршрута со статусом относительно конкретного проекта.
 *           properties:
 *             status:
 *               type: string
 *               enum: [completed, current, locked]
 *               description: completed — этап пройден; current — активный этап прямо сейчас; locked — маршрут до него ещё не дошёл.
 */
