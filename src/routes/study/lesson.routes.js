import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import lessonSchemas from '../../schemas/study/lesson.schema.js';
import { createLesson } from '../../controllers/study/lesson/create-lesson.controller.js';
import { listLessons } from '../../controllers/study/lesson/list-lessons.controller.js';
import { getLesson } from '../../controllers/study/lesson/get-lesson.controller.js';
import { updateLesson } from '../../controllers/study/lesson/update-lesson.controller.js';
import { deleteLesson } from '../../controllers/study/lesson/delete-lesson.controller.js';

const router = express.Router();

/**
 * @swagger
 * /study/lessons:
 *   get:
 *     tags: [Study / Lessons]
 *     summary: Список всех уроков
 *     description: Требует право 'study_lessons.read'. Возвращает мета-данные без content и questions — для выбора при составлении программы.
 *     responses:
 *       200:
 *         description: Список уроков
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudyLessonMeta'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('study_lessons.read'), listLessons);

/**
 * @swagger
 * /study/lessons:
 *   post:
 *     tags: [Study / Lessons]
 *     summary: Создать урок
 *     description: Требует право 'study_lessons.create'.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, content]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               content:
 *                 type: object
 *                 description: Контент в формате TipTap/ProseMirror JSON
 *               video:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   url:
 *                     type: string
 *                     format: uri
 *               presentation:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   url:
 *                     type: string
 *                     format: uri
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [questionText, answerOptions]
 *                   properties:
 *                     questionText:
 *                       type: string
 *                     answerOptions:
 *                       type: array
 *                       minItems: 2
 *                       items:
 *                         type: object
 *                         required: [text, isCorrect]
 *                         properties:
 *                           text:
 *                             type: string
 *                           isCorrect:
 *                             type: boolean
 *     responses:
 *       201:
 *         description: Урок создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyLesson'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('study_lessons.create'), validate(lessonSchemas.createLessonSchema), createLesson);

/**
 * @swagger
 * /study/lessons/{lessonId}:
 *   get:
 *     tags: [Study / Lessons]
 *     summary: Получить урок по ID
 *     description: Требует право 'study_lessons.read'. Возвращает полный урок включая вопросы с правильными ответами.
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Урок получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyLesson'
 *       404:
 *         description: Урок не найден
 */
router.get('/:lessonId', authMiddleware, checkPermission('study_lessons.read'), validate(lessonSchemas.lessonIdSchema), getLesson);

/**
 * @swagger
 * /study/lessons/{lessonId}:
 *   patch:
 *     tags: [Study / Lessons]
 *     summary: Обновить урок
 *     description: Требует право 'study_lessons.update'. Все поля опциональны.
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               content:
 *                 type: object
 *               video:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   url:
 *                     type: string
 *                     format: uri
 *               presentation:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   url:
 *                     type: string
 *                     format: uri
 *               questions:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Question'
 *     responses:
 *       200:
 *         description: Урок обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyLesson'
 *       404:
 *         description: Урок не найден
 */
router.patch('/:lessonId', authMiddleware, checkPermission('study_lessons.update'), validate(lessonSchemas.updateLessonSchema), updateLesson);

/**
 * @swagger
 * /study/lessons/{lessonId}:
 *   delete:
 *     tags: [Study / Lessons]
 *     summary: Удалить урок
 *     description: Требует право 'study_lessons.delete'.
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Урок удалён
 *       404:
 *         description: Урок не найден
 */
router.delete('/:lessonId', authMiddleware, checkPermission('study_lessons.delete'), validate(lessonSchemas.lessonIdSchema), deleteLesson);

export default router;
