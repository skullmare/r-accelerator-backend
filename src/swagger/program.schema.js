/**
 * @swagger
 * components:
 *   schemas:
 *     ModuleItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [StudyLesson, StudyAgent]
 *         itemId:
 *           type: string
 *           description: ID урока или агента
 *     StudyModule:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ModuleItem'
 *     StudyProgram:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         sequential:
 *           type: boolean
 *           description: Если true — уроки открываются последовательно
 *         active:
 *           type: boolean
 *         qrCode:
 *           type: string
 *         modules:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StudyModule'
 *         createdAt:
 *           type: string
 *           format: date-time
 */
