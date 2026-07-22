/**
 * @swagger
 * components:
 *   schemas:
 *     StudyAgent:
 *       type: object
 *       description: Обучающий агент курсов — конфигурация поверх готового ассистента OpenAI (домен "study", отдельный от Р-Акселератора).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор агента.
 *         name:
 *           type: string
 *           description: Имя агента для интерфейса.
 *         description:
 *           type: string
 *           description: Описание агента для каталога/списка программ.
 *         role:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *           description: Короткая пометка роли агента — только для отображения.
 *         avatar:
 *           type: string
 *           format: uri
 *           description: URL аватарки агента для интерфейса.
 *         openAiAssistantId:
 *           type: string
 *           description: Id ассистента в OpenAI Assistants API — используется как assistant_id при генерации ответов агента. Системный промпт и инструменты агента настраиваются на стороне OpenAI, не здесь.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания агента.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения агента.
 */
