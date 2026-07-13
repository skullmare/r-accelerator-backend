/**
 * @swagger
 * components:
 *   schemas:
 *     ExpertSession:
 *       type: object
 *       description: Диалог пользователя с одним агентом в рамках одного этапа маршрута проекта.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор сессии.
 *         projectId:
 *           type: string
 *           description: Проект, в рамках которого идёт диалог.
 *         agentId:
 *           type: string
 *           description: Агент, с которым идёт эта сессия. Сессию можно создать только для агента, совпадающего с текущим Project.currentAgentId — "перепрыгнуть" через агента, минуя маршрут, нельзя (409 AGENT_NOT_CURRENT).
 *         status:
 *           type: string
 *           enum: [draft, active, waiting_user_confirmation, completed, failed]
 *           description: |
 *             Статус сессии:
 *              * active — обычный диалог идёт;
 *              * waiting_user_confirmation — черновик артефакта сгенерирован (status=ready), но ещё не подтверждён;
 *              * completed — артефакт подтверждён, маршрут проекта уже переключён на следующего агента.
 *         inputContextSnapshot:
 *           type: object
 *           nullable: true
 *           description: Снимок того, что реально ушло в системный промпт при последнем сообщении (был ли подмешан summary проекта, какие фрагменты подтянулись из Qdrant) — аудит-лог для отладки, не рабочие данные.
 *         outputSummary:
 *           type: string
 *           nullable: true
 *           description: Краткая сводка результата сессии — дублирует summary созданного артефакта.
 *         artifactId:
 *           type: string
 *           nullable: true
 *           description: Ссылка на созданный артефакт этапа. Появляется уже на первом (черновом) вызове complete.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания сессии.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения сессии (новое сообщение, смена статуса).
 *     ExpertMessage:
 *       type: object
 *       description: Одна реплика в диалоге экспертной сессии (домен Р-Акселератора — отдельный от StudyMessage обучающих курсов).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор сообщения.
 *         sessionId:
 *           type: string
 *           description: Сессия, которой принадлежит сообщение.
 *         projectId:
 *           type: string
 *           description: Проект, которому принадлежит сообщение (денормализовано из сессии).
 *         senderType:
 *           type: string
 *           enum: [user, assistant, system]
 *           description: Кто автор сообщения. system зарезервирован на будущее, сейчас не создаётся автоматически.
 *         content:
 *           type: string
 *           description: Текст сообщения.
 *         tokenUsage:
 *           type: object
 *           nullable: true
 *           description: Статистика по токенам от провайдера LLM, если он её вернул (только для ответов ассистента) — для аудита расходов, на логику не влияет.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент отправки сообщения.
 *     ExpertArtifact:
 *       type: object
 *       description: Структурированный результат экспертного этапа — то, что агент должен произвести для перехода к следующему.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор артефакта.
 *         projectId:
 *           type: string
 *           description: Проект, которому принадлежит артефакт.
 *         expertSessionId:
 *           type: string
 *           description: Сессия, в рамках которой артефакт был сгенерирован.
 *         agentId:
 *           type: string
 *           description: Агент, создавший артефакт.
 *         type:
 *           type: string
 *           description: Тип артефакта — копия agent.artifactDefinition.artifactType на момент генерации.
 *         title:
 *           type: string
 *           description: Заголовок артефакта.
 *         content:
 *           type: object
 *           description: Сам артефакт — JSON-объект, сгенерированный моделью, прошедший проверку обязательных полей (и опционально JSON Schema). Проверяется только структура, не правдивость содержимого.
 *         summary:
 *           type: string
 *           description: Краткая сводка артефакта — именно она уходит в Project.contextSummary следующим агентам и индексируется в Qdrant.
 *         status:
 *           type: string
 *           enum: [draft, ready, confirmed, rejected]
 *           description: |
 *             Жизненный цикл: ready — черновик после complete без confirmArtifact;
 *             confirmed — после complete с confirmArtifact=true (только тогда артефакт индексируется в Qdrant и двигает маршрут проекта).
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания артефакта.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения (например, подтверждения).
 *     ExpertRouteItem:
 *       type: object
 *       description: Один агент в маршруте проекта, с его статусом относительно этого конкретного проекта (не глобальный статус агента).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор агента.
 *         name:
 *           type: string
 *           description: Имя агента для интерфейса.
 *         status:
 *           type: string
 *           enum: [completed, current, locked]
 *           description: completed — этап пройден (артефакт подтверждён); current — активный этап проекта прямо сейчас; locked — до этого агента маршрут ещё не дошёл.
 *         nextAgentId:
 *           type: string
 *           nullable: true
 *           description: _id следующего агента по маршруту (для построения UI-цепочки без отдельного запроса).
 */
