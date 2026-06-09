/**
 * @swagger
 * components:
 *   schemas:
 *     ProgressItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [StudyLesson, StudyAgent]
 *         item:
 *           type: object
 *           description: Краткие данные урока или агента (только _id и name)
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *         completed:
 *           type: boolean
 *           description: Пройден ли элемент пользователем
 *         accessible:
 *           type: boolean
 *           description: Доступен ли элемент (зависит от sequential и прогресса)
 *     ProgressModule:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProgressItem'
 *     StudyProgress:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         sequential:
 *           type: boolean
 *         modules:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProgressModule'
 */
