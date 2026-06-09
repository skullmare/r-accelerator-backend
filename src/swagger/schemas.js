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
 *         isSystem:
 *           type: boolean
 *         role:
 *           type: object
 *           nullable: true
 *           description: Популяция роли. GET /users возвращает только _id+name, GET /users/:id и GET /profile возвращают _id+name+permissions
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             permissions:
 *               type: array
 *               items:
 *                 type: string
 *         studyPrograms:
 *           type: array
 *           description: Краткие данные программ пользователя (только _id и name)
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               name:
 *                 type: string
 *         lastLogin:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
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
 *         createdAt:
 *           type: string
 *           format: date-time
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
 *     StudyLessonMeta:
 *       type: object
 *       description: Мета-данные урока без content и questions (используется в списках)
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         video:
 *           type: object
 *           nullable: true
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *         presentation:
 *           type: object
 *           nullable: true
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *         createdAt:
 *           type: string
 *           format: date-time
 *     StudyLessonWithProgress:
 *       type: object
 *       description: Урок для пользователя — без isCorrect, с userAnswer на каждом вопросе
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         content:
 *           type: object
 *           description: Контент урока в формате TipTap/ProseMirror JSON
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Question'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     AnswerOption:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         text:
 *           type: string
 *     AnswerOptionWithCorrect:
 *       type: object
 *       description: Вариант ответа с полем isCorrect (только в admin API)
 *       properties:
 *         _id:
 *           type: string
 *         text:
 *           type: string
 *         isCorrect:
 *           type: boolean
 *     Question:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         questionText:
 *           type: string
 *         answerOptions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AnswerOption'
 *         userAnswer:
 *           type: string
 *           nullable: true
 *           description: ID выбранного ответа пользователя (только в пользовательском API)
 *     QuestionWithCorrect:
 *       type: object
 *       description: Вопрос с правильными ответами (только в admin API)
 *       properties:
 *         _id:
 *           type: string
 *         questionText:
 *           type: string
 *         answerOptions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AnswerOptionWithCorrect'
 *     StudyLesson:
 *       type: object
 *       description: Полный урок с контентом и вопросами (admin API)
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         video:
 *           type: object
 *           nullable: true
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *         presentation:
 *           type: object
 *           nullable: true
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *         content:
 *           type: object
 *           description: Контент урока в формате TipTap/ProseMirror JSON
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuestionWithCorrect'
 *         createdAt:
 *           type: string
 *           format: date-time
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
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         total:
 *           type: integer
 *           example: 42
 *         totalPages:
 *           type: integer
 *           example: 5
 *         hasMore:
 *           type: boolean
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
