import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import groupSchemas from '../../schemas/course/group.schema.js';
import { createGroup } from '../../controllers/course/group/create-group.controller.js';
import { getGroup } from '../../controllers/course/group/get-group.controller.js';
import { listGroups } from '../../controllers/course/group/list-groups.controller.js';
import { updateGroup } from '../../controllers/course/group/update-group.controller.js';
import { deleteGroup } from '../../controllers/course/group/delete-group.controller.js';
import { addToGroup } from '../../controllers/course/group/add-to-group.controller.js';

const router = express.Router();

/**
 * @swagger
 * /course/groups/join:
 *   post:
 *     tags: [Course / Groups]
 *     summary: Вступить в группу по QR-коду
 *     description: Привязывает текущего пользователя к группе по её секретному QR-коду. Группа должна быть активна.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Вы добавлены в группу
 *       404:
 *         description: Группа не найдена или неактивна
 */
router.post('/join', authMiddleware, validate(groupSchemas.addToGroupSchema), addToGroup);

/**
 * @swagger
 * /course/groups:
 *   get:
 *     tags: [Course / Groups]
 *     summary: Список всех групп
 *     description: Требует право `course_groups.read`.
 *     responses:
 *       200:
 *         description: Список групп с популяцией агентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CourseGroup'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('course_groups.read'), listGroups);

/**
 * @swagger
 * /course/groups:
 *   post:
 *     tags: [Course / Groups]
 *     summary: Создать группу
 *     description: Требует право `course_groups.create`. QR-код генерируется автоматически.
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
 *               agents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Массив ID агентов
 *               active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Группа создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseGroup'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('course_groups.create'), validate(groupSchemas.createGroupSchema), createGroup);

/**
 * @swagger
 * /course/groups/{id}:
 *   get:
 *     tags: [Course / Groups]
 *     summary: Получить группу по ID
 *     description: Требует право `course_groups.read`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Группа получена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseGroup'
 *       404:
 *         description: Группа не найдена
 */
router.get('/:id', authMiddleware, checkPermission('course_groups.read'), validate(groupSchemas.groupIdSchema), getGroup);

/**
 * @swagger
 * /course/groups/{id}:
 *   put:
 *     tags: [Course / Groups]
 *     summary: Обновить группу
 *     description: Требует право `course_groups.update`. Передайте updateQRCode=true для генерации нового QR-кода.
 *     parameters:
 *       - in: path
 *         name: id
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
 *               agents:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *               updateQRCode:
 *                 type: boolean
 *                 description: Пересоздать QR-код
 *     responses:
 *       200:
 *         description: Группа обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseGroup'
 *       404:
 *         description: Группа не найдена
 */
router.put('/:id', authMiddleware, checkPermission('course_groups.update'), validate(groupSchemas.updateGroupSchema), updateGroup);

/**
 * @swagger
 * /course/groups/{id}:
 *   delete:
 *     tags: [Course / Groups]
 *     summary: Удалить группу
 *     description: Требует право `course_groups.delete`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Группа удалена
 *       404:
 *         description: Группа не найдена
 */
router.delete('/:id', authMiddleware, checkPermission('course_groups.delete'), validate(groupSchemas.groupIdSchema), deleteGroup);

export default router;
