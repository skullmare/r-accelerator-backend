import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import userSchemas from '../schemas/user.schema.js';
import { listUsers } from '../controllers/user/list-users.controller.js';
import { getUser } from '../controllers/user/get-user.controller.js';
import { updateUser } from '../controllers/user/update-user.controller.js';
import { updateUserRole } from '../controllers/user/update-user-role.controller.js';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Список всех пользователей
 *     description: Требует право `users.read`.
 *     responses:
 *       200:
 *         description: Список пользователей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('users.read'), listUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Получить пользователя по ID
 *     description: Требует право `users.read`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Пользователь получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Пользователь не найден
 */
router.get('/:id', authMiddleware, checkPermission('users.read'), validate(userSchemas.userIdSchema), getUser);

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     tags: [Users]
 *     summary: Обновить роль пользователя
 *     description: Требует право `users.update`.
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 description: ID роли
 *     responses:
 *       200:
 *         description: Роль пользователя обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Пользователь не найден
 */
router.put('/:id/role', authMiddleware, checkPermission('users.update'), validate(userSchemas.updateUserRoleSchema), updateUserRole);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Обновить данные пользователя
 *     description: Требует право `users.update`.
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
 *               firstName:
 *                 type: string
 *               profession:
 *                 type: string
 *               fieldOfActivity:
 *                 type: string
 *               city:
 *                 type: string
 *               courseGroup:
 *                 type: string
 *                 description: ID группы (или null для сброса)
 *     responses:
 *       200:
 *         description: Пользователь обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Пользователь не найден
 */
router.put('/:id', authMiddleware, checkPermission('users.update'), validate(userSchemas.updateUserSchema), updateUser);

export default router;
