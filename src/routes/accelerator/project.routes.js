import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import checkAccessProject from '../../middlewares/check-access-project.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import projectSchemas from '../../schemas/accelerator/project.schema.js';
import { listProjects } from '../../controllers/accelerator/project/list-projects.controller.js';
import { createProject } from '../../controllers/accelerator/project/create-project.controller.js';
import { getProject } from '../../controllers/accelerator/project/get-project.controller.js';
import { updateProject } from '../../controllers/accelerator/project/update-project.controller.js';

const router = express.Router();

/**
 * @swagger
 * /accelerator/projects:
 *   get:
 *     tags: [Accelerator / Projects]
 *     summary: Список проектов текущего пользователя
 *     description: Возвращает только проекты, принадлежащие авторизованному пользователю.
 *     responses:
 *       200:
 *         description: Список проектов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   ownerId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                     nullable: true
 *                   userRole:
 *                     type: string
 *                     nullable: true
 *                   industry:
 *                     type: string
 *                     nullable: true
 *                   businessSpecifics:
 *                     type: string
 *                     nullable: true
 *                   stage:
 *                     type: string
 *                     enum: [idea, mvp, launched, growth, scale]
 *                   goal:
 *                     type: string
 *                     nullable: true
 *                   status:
 *                     type: string
 *                     enum: [active, paused, completed, archived]
 *                   progress:
 *                     type: number
 *                   lastActivityAt:
 *                     type: string
 *                     format: date-time
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Требуется авторизация
 */
router.get('/', authMiddleware, listProjects);

/**
 * @swagger
 * /accelerator/projects:
 *   post:
 *     tags: [Accelerator / Projects]
 *     summary: Создать проект
 *     description: Владельцем создаваемого проекта становится текущий авторизованный пользователь.
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
 *                 maxLength: 150
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               userRole:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *               industry:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *               businessSpecifics:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               stage:
 *                 type: string
 *                 enum: [idea, mvp, launched, growth, scale]
 *               goal:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, archived]
 *     responses:
 *       201:
 *         description: Проект создан
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Требуется авторизация
 */
router.post('/', authMiddleware, validate(projectSchemas.createProjectSchema), createProject);

/**
 * @swagger
 * /accelerator/projects/{projectId}:
 *   get:
 *     tags: [Accelerator / Projects]
 *     summary: Получить проект по ID
 *     description: Доступ только у владельца проекта.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Проект получен
 *       401:
 *         description: Требуется авторизация
 *       403:
 *         description: Нет доступа к проекту
 *       404:
 *         description: Проект не найден
 */
router.get('/:projectId', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, getProject);

/**
 * @swagger
 * /accelerator/projects/{projectId}:
 *   patch:
 *     tags: [Accelerator / Projects]
 *     summary: Обновить проект
 *     description: Доступ только у владельца проекта. lastActivityAt обновляется автоматически.
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *                 maxLength: 150
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               userRole:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *               industry:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *               businessSpecifics:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               stage:
 *                 type: string
 *                 enum: [idea, mvp, launched, growth, scale]
 *               goal:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, archived]
 *     responses:
 *       200:
 *         description: Проект обновлён
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Требуется авторизация
 *       403:
 *         description: Нет доступа к проекту
 *       404:
 *         description: Проект не найден
 */
router.patch('/:projectId', authMiddleware, validate(projectSchemas.updateProjectSchema), checkAccessProject, updateProject);

export default router;
