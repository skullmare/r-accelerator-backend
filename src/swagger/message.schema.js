/**
 * @swagger
 * components:
 *   schemas:
 *     StudyMessage:
 *       type: object
 *       description: Одна реплика в диалоге пользователя с обучающим агентом (домен "study" — отдельный от ExpertMessage Р-Акселератора).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор сообщения.
 *         messageText:
 *           type: string
 *           description: Текст сообщения — реплика пользователя или накопленный из стрима OpenAI ответ агента.
 *         user:
 *           type: string
 *           description: Пользователь, участвующий в диалоге (id, без популяции).
 *         agent:
 *           type: string
 *           description: Обучающий агент, с которым идёт диалог (id, без популяции).
 *         author:
 *           type: string
 *           enum: [user, agent]
 *           description: Кто автор конкретного сообщения.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент отправки сообщения.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения записи.
 *     OpenAiAssistant:
 *       type: object
 *       description: Ассистент OpenAI, доступный для привязки к обучающему агенту.
 *       properties:
 *         id:
 *           type: string
 *           description: Id ассистента в OpenAI — то же значение, что кладётся в StudyAgent.openAiAssistantId.
 *         name:
 *           type: string
 *           description: Имя ассистента, как оно задано в OpenAI.
 */
