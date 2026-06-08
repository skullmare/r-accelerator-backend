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
 *     summary: Список пользователей
 *     description: Требует право `users.read`. Поддерживает пагинацию и поиск по email.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: Фильтр по email (частичное совпадение)
 *     responses:
 *       200:
 *         description: Список пользователей с пагинацией
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('users.read'), validate(userSchemas.listUsersSchema), listUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Получить пользователя по ID
 *     description: Требует право `users.read`. Возвращает пользователя с популяцией role и studyPrograms.
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
 *     summary: Назначить роль пользователю
 *     description: Требует право `users_role.update`. Передайте `role: null` чтобы убрать роль.
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
 *                 nullable: true
 *                 description: ID роли или null для снятия роли
 *     responses:
 *       200:
 *         description: Роль обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Нельзя изменить роль системного пользователя
 *       404:
 *         description: Пользователь не найден
 */
router.put('/:id/role', authMiddleware, checkPermission('users_role.update'), validate(userSchemas.updateUserRoleSchema), updateUserRole);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Обновить данные пользователя
 *     description: Требует право `users.update`. Поле `studyPrograms` принимает полный новый массив ID программ.
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
 *               lastName:
 *                 type: string
 *               profession:
 *                 type: string
 *               fieldOfActivity:
 *                 type: string
 *               city:
 *                 type: string
 *               studyPrograms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Массив ID программ обучения
 *     responses:
 *       200:
 *         description: Пользователь обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Нельзя обновить системного пользователя
 *       404:
 *         description: Пользователь не найден
 */
router.patch('/:id', authMiddleware, checkPermission('users.update'), validate(userSchemas.updateUserSchema), updateUser);

export default router;
