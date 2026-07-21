/**
 * @swagger
 * components:
 *   schemas:
 *     AcceleratorKnowledge:
 *       type: object
 *       description: Глобальная база знаний для агентов Р-Акселератора. Управляется только из админки (право accelerator_knowledge.manage), не привязана к проекту/пользователю. Векторизуется в отдельную Qdrant-коллекцию knowledge_context.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор базы знаний. По нему knowledge привязывается к агенту (Agent.knowledgeIds) и фильтруются точки в Qdrant.
 *         title:
 *           type: string
 *           description: Название для интерфейса админки.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Необязательное описание (для UI).
 *         fileId:
 *           type: string
 *           nullable: true
 *           description: _id уже загруженного File, если источник — файл из S3. Взаимоисключим с sourceUrl.
 *         sourceUrl:
 *           type: string
 *           nullable: true
 *           description: Внешняя ссылка на файл, если источник — URL. Взаимоисключима с fileId.
 *         sourceMimeType:
 *           type: string
 *           nullable: true
 *           description: MIME-тип, по которому выбирался экстрактор при последней обработке.
 *         status:
 *           type: string
 *           enum: [pending, processing, indexed, unsupported, failed]
 *           description: Статус синхронной векторизации.
 *         chunksCount:
 *           type: integer
 *           description: Количество проиндексированных чанков.
 *         processingError:
 *           type: string
 *           nullable: true
 *           description: Короткое описание последней ошибки обработки (для UI).
 *         processingErrorCode:
 *           type: string
 *           nullable: true
 *           description: Машиночитаемый код ошибки (SOURCE_FETCH_FAILED / QDRANT_INDEX_FAILED).
 *         indexedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Момент последней успешной индексации.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
