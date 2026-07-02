import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import projectSchemas from '../../schemas/accelerator/project.schema.js';
import { listProjects } from '../../controllers/accelerator/project/list-projects.controller.js';
import { createProject } from '../../controllers/accelerator/project/create-project.controller.js';

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

export default router;
