/**
 * @swagger
 * components:
 *   schemas:
 *     StudyLessonMeta:
 *       type: object
 *       description: Мета-данные урока без content (используется в списках)
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         cover:
 *           type: string
 *           nullable: true
 *           description: URL фото-обложки урока
 *         group:
 *           nullable: true
 *           description: Группа урока (populated)
 *           oneOf:
 *             - $ref: '#/components/schemas/LessonGroup'
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
 *       description: Полный урок с контентом (admin API)
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         cover:
 *           type: string
 *           nullable: true
 *           description: URL фото-обложки урока
 *         group:
 *           nullable: true
 *           description: ID группы урока
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
 *         createdAt:
 *           type: string
 *           format: date-time
 *     StudyLessonWithProgress:
 *       type: object
 *       description: Урок для пользователя
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         content:
 *           type: object
 *           description: Контент урока в формате TipTap/ProseMirror JSON
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
