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
 *         item:
 *           oneOf:
 *             - $ref: '#/components/schemas/StudyLesson'
 *             - $ref: '#/components/schemas/StudyAgent'
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
 *         description:
 *           type: string
 *           nullable: true
 *           description: Небольшой текст описания для UI
 *         coverMeta:
 *           type: object
 *           nullable: true
 *           description: Произвольный JSON-объект с мета-данными обложки для UI
 *           additionalProperties: true
 *         cover:
 *           type: string
 *           nullable: true
 *           description: URL обложки программы
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
