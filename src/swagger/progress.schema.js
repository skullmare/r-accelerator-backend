/**
 * @swagger
 * components:
 *   schemas:
 *     ProgressItem:
 *       type: object
 *       description: >
 *         Элемент модуля программы, смёрженный с прогрессом пользователя
 *         (get-progress.controller.js). item заполняется одним из двух отдельных
 *         запросов в зависимости от type: StudyLesson.find(..., 'name') или
 *         StudyAgent.find(..., 'name avatar role') — поля item для урока и агента
 *         НЕ взаимозаменяемы, у урока никогда не будет avatar/role.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор элемента внутри модуля.
 *         type:
 *           type: string
 *           enum: [StudyLesson, StudyAgent]
 *           description: Тип элемента — определяет, по какой карте (уроков или агентов) искался item.
 *         item:
 *           type: object
 *           nullable: true
 *           description: >
 *             Краткие данные урока или агента. Для type=StudyLesson это всегда
 *             { _id, name } — поля avatar/role отсутствуют. Для type=StudyAgent это
 *             { _id, name, avatar, role }. Схема ниже — объединение обоих вариантов
 *             для простоты документации, но на практике avatar/role приходят
 *             только у агентов. Может быть null, если исходный урок/агент был
 *             удалён, но остался в modules программы (populated не найден).
 *           properties:
 *             _id:
 *               type: string
 *               description: Идентификатор урока или агента.
 *             name:
 *               type: string
 *               description: Название урока или имя агента.
 *             avatar:
 *               type: string
 *               format: uri
 *               description: URL аватарки — присутствует только когда type=StudyAgent.
 *             role:
 *               type: string
 *               nullable: true
 *               description: Короткая пометка роли агента — присутствует только когда type=StudyAgent.
 *         completed:
 *           type: boolean
 *           description: >
 *             Пройден ли элемент пользователем — true, если его id есть в
 *             StudyProgress.completedItems.
 *         accessible:
 *           type: boolean
 *           description: >
 *             Доступен ли элемент пользователю: !program.sequential || !prevItem ||
 *             completedIds.has(prevItem.item) — т.е. либо программа не
 *             последовательная, либо это первый элемент модуля, либо предыдущий
 *             элемент по порядку в модуле уже пройден.
 *     ProgressModule:
 *       type: object
 *       description: Модуль программы со списком элементов, смёрженных с прогрессом пользователя.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор модуля.
 *         name:
 *           type: string
 *           description: Название модуля программы.
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProgressItem'
 *     StudyProgress:
 *       type: object
 *       description: >
 *         Программа с прогрессом текущего пользователя — get-progress.controller.js
 *         вручную собирает объект { _id, name, cover, sequential, modules }, поэтому
 *         здесь намеренно нет description, active, qrCode и createdAt/updatedAt
 *         (в отличие от полного StudyProgram).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор программы.
 *         name:
 *           type: string
 *           description: Название программы обучения.
 *         cover:
 *           type: string
 *           nullable: true
 *           description: URL обложки программы.
 *         sequential:
 *           type: boolean
 *           description: >
 *             Если true — элементы модулей доступны строго по порядку прохождения
 *             (см. accessible в ProgressItem).
 *         modules:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProgressModule'
 */
