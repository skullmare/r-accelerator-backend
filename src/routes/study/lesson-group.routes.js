import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import lessonGroupSchemas from '../../schemas/study/lesson-group.schema.js';
import { createLessonGroup } from '../../controllers/study/lesson-group/create-lesson-group.controller.js';
import { listLessonGroups } from '../../controllers/study/lesson-group/list-lesson-groups.controller.js';
import { updateLessonGroup } from '../../controllers/study/lesson-group/update-lesson-group.controller.js';
import { deleteLessonGroup } from '../../controllers/study/lesson-group/delete-lesson-group.controller.js';

const router = express.Router();

/**
 * @swagger
 * /study/lesson-groups:
 *   get:
 *     tags: [Study / Lesson Groups]
 *     summary: Список всех групп уроков
 *     description: Требует право 'study_lessons.read'.
 *     responses:
 *       200:
 *         description: Список групп
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LessonGroup'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('study_lessons.read'), listLessonGroups);

/**
 * @swagger
 * /study/lesson-groups:
 *   post:
 *     tags: [Study / Lesson Groups]
 *     summary: Создать группу уроков
 *     description: Требует право 'study_lessons.create'.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       201:
 *         description: Группа создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LessonGroup'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('study_lessons.create'), validate(lessonGroupSchemas.createLessonGroupSchema), createLessonGroup);

/**
 * @swagger
 * /study/lesson-groups/{groupId}:
 *   patch:
 *     tags: [Study / Lesson Groups]
 *     summary: Переименовать группу уроков
 *     description: Требует право 'study_lessons.update'.
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Группа обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LessonGroup'
 *       404:
 *         description: Группа не найдена
 */
router.patch('/:groupId', authMiddleware, checkPermission('study_lessons.update'), validate(lessonGroupSchemas.updateLessonGroupSchema), updateLessonGroup);

/**
 * @swagger
 * /study/lesson-groups/{groupId}:
 *   delete:
 *     tags: [Study / Lesson Groups]
 *     summary: Удалить группу уроков
 *     description: Требует право 'study_lessons.delete'. У уроков, принадлежавших этой группе, поле group обнуляется.
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Группа удалена
 *       404:
 *         description: Группа не найдена
 */
router.delete('/:groupId', authMiddleware, checkPermission('study_lessons.delete'), validate(lessonGroupSchemas.lessonGroupIdSchema), deleteLessonGroup);

export default router;
