/**
 * @swagger
 * components:
 *   schemas:
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
 */
