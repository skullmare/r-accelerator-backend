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
 *         completionState:
 *           type: object
 *           description: |
 *             Готовность этапа (DONE-4): арифметика по заполненности collectedFields, а не
 *             оценка отдельной моделью. ready=true, когда агент закрыл все обязательные поля
 *             артефакта (кроме поля-сводки). Фронт показывает кнопку «сформировать артефакт»
 *             только при ready=true. Попытка complete при ready=false вернёт 409 STAGE_NOT_READY.
 *           properties:
 *             ready:
 *               type: boolean
 *               description: Собраны ли все данные, необходимые для завершения этапа.
 *             missingFields:
 *               type: array
 *               items: { type: string }
 *               description: Обязательные поля артефакта, данные для которых ещё не собраны в диалоге.
 *             reason:
 *               type: string
 *               nullable: true
 *               description: Человекочитаемое пояснение (сколько полей собрано и каких не хватает).
 *             evaluatedAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *               description: Когда готовность пересчитывалась в последний раз. null — ещё ни разу.
 *             evaluatedAfterMessageId:
 *               type: string
 *               nullable: true
 *               description: Последнее сообщение на момент пересчёта. Пересчёт не требует вызова модели, поэтому гейт завершения этапа всегда считает поля заново.
 *         collectedFields:
 *           type: object
 *           description: |
 *             Карточка этапа: данные, собранные агентом в диалоге, по одному ключу на обязательное
 *             поле артефакта. Заполняется агентом через инструмент save_collected_fields; quote —
 *             дословный фрагмент реплики пользователя, который сервер сверяет с сообщениями сессии,
 *             поэтому закрыть поле данными, которых пользователь не давал, нельзя.
 *           additionalProperties:
 *             type: object
 *             properties:
 *               value: { type: string, description: "Итоговая формулировка данных по полю." }
 *               quote: { type: string, description: "Дословный фрагмент реплики пользователя — подтверждение происхождения." }
 *               sourceMessageId: { type: string, nullable: true, description: "Сообщение, после которого поле записали." }
 *               updatedAt: { type: string, format: date-time }
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
 *       description: Результат экспертного этапа. Для пользователя это PDF-документ (file.url); структурированный content — служебный слой для передачи контекста следующим агентам и индексации в Qdrant.
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
 *           description: Структурированные данные артефакта — JSON-объект, сгенерированный моделью, прошедший проверку обязательных полей (и опционально JSON Schema). Проверяется только структура, не правдивость содержимого.
 *         documentMarkdown:
 *           type: string
 *           nullable: true
 *           description: Текст документа в Markdown — исходник, из которого сервер сверстал PDF. Хранится для возможности перерендера без повторного обращения к LLM.
 *         file:
 *           type: object
 *           description: Сгенерированный PDF в S3 — основной результат этапа для пользователя. Заполняется уже на стадии черновика, до подтверждения.
 *           properties:
 *             key:
 *               type: string
 *               nullable: true
 *               description: Ключ объекта в S3.
 *             url:
 *               type: string
 *               nullable: true
 *               description: Публичная ссылка на PDF — её фронт показывает пользователю для просмотра/скачивания.
 *             mimeType:
 *               type: string
 *               description: MIME-тип файла (application/pdf).
 *             size:
 *               type: integer
 *               nullable: true
 *               description: Размер файла в байтах.
 *             generatedAt:
 *               type: string
 *               format: date-time
 *               nullable: true
 *               description: Когда файл был сгенерирован.
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
