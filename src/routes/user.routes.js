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
 *     description: Требует право 'users.read'. Поддерживает пагинацию и поиск по email. role популируется только как { _id, name } (без permissions) — за правами конкретного пользователя используйте GET /users/{id}.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Размер страницы.
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: Фильтр по email (частичное совпадение, регистронезависимо)
 *     responses:
 *       200:
 *         description: Список пользователей с пагинацией
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Список пользователей получен" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Недостаточно прав
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, checkPermission('users.read'), validate(userSchemas.listUsersSchema), listUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Получить пользователя по ID
 *     description: Требует право 'users.read'. Возвращает пользователя с полной популяцией role ({ _id, name, permissions }) и studyPrograms ({ _id, name }).
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
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Пользователь получен" }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authMiddleware, checkPermission('users.read'), validate(userSchemas.userIdSchema), getUser);

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     tags: [Users]
 *     summary: Назначить роль пользователю
 *     description: Требует право users_role.update. Передайте role=null чтобы убрать роль. Нельзя изменить роль системного пользователя (400). role в ответе популируется ({ _id, name, permissions }), studyPrograms — нет (остаётся массивом id).
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
 *                 description: ID роли или null для снятия роли.
 *     responses:
 *       200:
 *         description: Роль обновлена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Роль пользователя обновлена" }
 *                 data:
 *                   type: object
 *                   description: Документ User; role популирован, studyPrograms — нет (массив id).
 *                   properties:
 *                     _id: { type: string }
 *                     email: { type: string, format: email }
 *                     role:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         _id: { type: string }
 *                         name: { type: string }
 *                         permissions: { type: array, items: { type: string } }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     studyPrograms:
 *                       type: array
 *                       items: { type: string }
 *                       description: Id программ, без популяции.
 *                     isSystem: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       400:
 *         description: Нельзя изменить роль системного пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/role', authMiddleware, checkPermission('users_role.update'), validate(userSchemas.updateUserRoleSchema), updateUserRole);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Обновить данные пользователя
 *     description: Требует право 'users.update'. Поле studyPrograms принимает полный новый массив ID программ (замена, не добавление). Нельзя обновить системного пользователя (400). Ответ НЕ популирует role/studyPrograms — они возвращаются как есть (id / массив id).
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
 *                 description: Полный новый массив ID программ обучения.
 *     responses:
 *       200:
 *         description: Пользователь обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Пользователь обновлён" }
 *                 data:
 *                   type: object
 *                   description: Документ User без популяции role/studyPrograms.
 *                   properties:
 *                     _id: { type: string }
 *                     email: { type: string, format: email }
 *                     role: { type: string, nullable: true, description: "Id роли, без популяции." }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     profession: { type: string }
 *                     fieldOfActivity: { type: string }
 *                     city: { type: string }
 *                     studyPrograms:
 *                       type: array
 *                       items: { type: string }
 *                       description: Id программ, без популяции.
 *                     isSystem: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       400:
 *         description: Нельзя обновить системного пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id', authMiddleware, checkPermission('users.update'), validate(userSchemas.updateUserSchema), updateUser);

export default router;
