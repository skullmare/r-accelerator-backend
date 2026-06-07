/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         profession:
 *           type: string
 *         fieldOfActivity:
 *           type: string
 *         city:
 *           type: string
 *         role:
 *           $ref: '#/components/schemas/Role'
 *         studyProgram:
 *           $ref: '#/components/schemas/StudyProgram'
 *         lastLogin:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     Role:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         isSystem:
 *           type: boolean
 *     StudyAgent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         role:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         avatar:
 *           type: string
 *           format: uri
 *         openAiAssistantId:
 *           type: string
 *         baseMessages:
 *           type: array
 *           items:
 *             type: string
 *     StudyProgram:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         agents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/StudyAgent'
 *         active:
 *           type: boolean
 *         qrCode:
 *           type: string
 *     StudyMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         messageText:
 *           type: string
 *         user:
 *           type: string
 *         agent:
 *           type: string
 *         author:
 *           type: string
 *           enum: [user, agent]
 *         createdAt:
 *           type: string
 *           format: date-time
 *     OpenAiAssistant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           description: Текущая страница
 *           example: 1
 *         limit:
 *           type: integer
 *           description: Количество элементов на странице
 *           example: 10
 *         total:
 *           type: integer
 *           description: Общее количество элементов
 *           example: 42
 *         totalPages:
 *           type: integer
 *           description: Общее количество страниц
 *           example: 5
 *         hasMore:
 *           type: boolean
 *           description: Есть ли ещё страницы
 *           example: true
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 */
