import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import roleSchemas from '../schemas/role.schema.js';
import { listRoles } from '../controllers/role/list-roles.controller.js';
import { getRole } from '../controllers/role/get-role.controller.js';
import { createRole } from '../controllers/role/create-role.controller.js';
import { updateRole } from '../controllers/role/update-role.controller.js';
import { deleteRole } from '../controllers/role/delete-role.controller.js';
import { listPermissions } from '../controllers/role/list-permissions.controller.js';

const router = express.Router();

/**
 * @swagger
 * /roles/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: Список всех возможных прав
 *     description: Возвращает все доступные права, сгруппированные по категориям. Требует право `roles.read`.
 *     responses:
 *       200:
 *         description: Список прав по группам
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   group:
 *                     type: string
 *                     example: Роли
 *                   actions:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         key:
 *                           type: string
 *                           example: roles.read
 *                         label:
 *                           type: string
 *                           example: Просмотр списка ролей
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Недостаточно прав
 */
router.get('/permissions', authMiddleware, checkPermission('roles.read'), listPermissions);

/**
 * @swagger
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: Список всех ролей
 *     description: Требует право `roles.read`.
 *     responses:
 *       200:
 *         description: Список ролей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Role'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('roles.read'), listRoles);

/**
 * @swagger
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Создать роль
 *     description: Требует право `roles.create`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, permissions]
 *             properties:
 *               name:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["agents.read", "course_groups.read"]
 *     responses:
 *       201:
 *         description: Роль создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('roles.create'), validate(roleSchemas.createRoleSchema), createRole);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     tags: [Roles]
 *     summary: Получить роль по ID
 *     description: Требует право `roles.read`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Роль получена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 *       404:
 *         description: Роль не найдена
 */
router.get('/:id', authMiddleware, checkPermission('roles.read'), validate(roleSchemas.roleIdSchema), getRole);

/**
 * @swagger
 * /roles/{id}:
 *   put:
 *     tags: [Roles]
 *     summary: Обновить роль
 *     description: Требует право `roles.update`. Системные роли (isSystem=true) нельзя изменить.
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
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Роль обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 *       403:
 *         description: Системную роль нельзя изменить
 *       404:
 *         description: Роль не найдена
 */
router.put('/:id', authMiddleware, checkPermission('roles.update'), validate(roleSchemas.updateRoleSchema), updateRole);

/**
 * @swagger
 * /roles/{id}:
 *   delete:
 *     tags: [Roles]
 *     summary: Удалить роль
 *     description: Требует право `roles.delete`. Системные роли (isSystem=true) нельзя удалить.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Роль удалена
 *       403:
 *         description: Системную роль нельзя удалить
 *       404:
 *         description: Роль не найдена
 */
router.delete('/:id', authMiddleware, checkPermission('roles.delete'), validate(roleSchemas.roleIdSchema), deleteRole);

export default router;
