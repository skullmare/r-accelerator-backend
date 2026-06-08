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

// список всех уроков (без content и questions) — для выбора при составлении программы
router.get('/', authMiddleware, checkPermission('study_lessons.read'), listLessons);

// создать урок с контентом, видео, презентацией и вопросами теста
router.post('/', authMiddleware, checkPermission('study_lessons.create'), validate(lessonSchemas.createLessonSchema), createLesson);

// получить полный урок включая вопросы с правильными ответами (только admin)
router.get('/:lessonId', authMiddleware, checkPermission('study_lessons.read'), validate(lessonSchemas.lessonIdSchema), getLesson);

// обновить любые поля урока
router.patch('/:lessonId', authMiddleware, checkPermission('study_lessons.update'), validate(lessonSchemas.updateLessonSchema), updateLesson);

// удалить урок
router.delete('/:lessonId', authMiddleware, checkPermission('study_lessons.delete'), validate(lessonSchemas.lessonIdSchema), deleteLesson);

export default router;
