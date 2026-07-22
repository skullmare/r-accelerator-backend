/**
 * @swagger
 * components:
 *   schemas:
 *     Pagination:
 *       type: object
 *       description: Метаданные постраничной выдачи, сопровождающие список.
 *       properties:
 *         page:
 *           type: integer
 *           description: Номер текущей страницы (с 1).
 *           example: 1
 *         limit:
 *           type: integer
 *           description: Сколько элементов на странице.
 *           example: 10
 *         total:
 *           type: integer
 *           description: Общее количество элементов по всем страницам.
 *           example: 42
 *         totalPages:
 *           type: integer
 *           description: Общее количество страниц.
 *           example: 5
 *         hasMore:
 *           type: boolean
 *           description: Есть ли ещё страницы после текущей (page < totalPages).
 *           example: true
 *     Error:
 *       type: object
 *       description: Единая форма ответа при ошибке (см. resify-express errorResponse/errorMiddleware) — success всегда false, полезная нагрузка не через data, а через error.
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           description: Человекочитаемое описание ошибки на русском.
 *         error:
 *           type: object
 *           description: Дополнительные машиночитаемые детали ошибки. Оба поля могут быть null, если контроллер их не передал.
 *           properties:
 *             code:
 *               type: string
 *               nullable: true
 *               description: Короткий машиночитаемый код ошибки (например AGENT_NOT_FOUND), если контроллер его указал.
 *             description:
 *               type: string
 *               nullable: true
 *               description: Дополнительное текстовое пояснение (часто — исходное сообщение исключения).
 */
