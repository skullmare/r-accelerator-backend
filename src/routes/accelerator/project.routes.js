import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import checkAccessProject from '../../middlewares/check-access-project.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import projectSchemas from '../../schemas/accelerator/project.schema.js';
import { listProjects } from '../../controllers/accelerator/project/list-projects.controller.js';
import { createProject } from '../../controllers/accelerator/project/create-project.controller.js';
import { getProject } from '../../controllers/accelerator/project/get-project.controller.js';
import { updateProject } from '../../controllers/accelerator/project/update-project.controller.js';
import { listProjectFiles } from '../../controllers/accelerator/file/list-project-files.controller.js';
import { reindexFile } from '../../controllers/accelerator/file/reindex-file.controller.js';
import { getFileProcessingStatus } from '../../controllers/accelerator/file/get-file-processing-status.controller.js';
import expertSessionSchemas from '../../schemas/accelerator/expert-session.schema.js';
import { getExpertRoute } from '../../controllers/accelerator/expert-session/get-expert-route.controller.js';
import { createExpertSession } from '../../controllers/accelerator/expert-session/create-session.controller.js';
import { sendExpertMessage } from '../../controllers/accelerator/expert-session/send-message.controller.js';
import { completeExpertSession } from '../../controllers/accelerator/expert-session/complete-session.controller.js';

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

/**
 * @swagger
 * /accelerator/projects/{projectId}/files:
 *   get:
 *     tags: [Accelerator / Files]
 *     summary: Список файлов проекта со статусами обработки
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Список файлов проекта }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект не найден }
 */
router.get('/:projectId/files', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, listProjectFiles);

/**
 * @swagger
 * /accelerator/projects/{projectId}/files/{fileId}/index:
 *   post:
 *     tags: [Accelerator / Files]
 *     summary: Запустить (пере)индексацию файла в Qdrant
 *     description: Ставит файл в очередь на извлечение текста, чанкинг и индексацию в Qdrant. Не блокирует запрос — обработка выполняется асинхронно воркером.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202: { description: Индексация поставлена в очередь }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект или файл не найден }
 */
router.post('/:projectId/files/:fileId/index', authMiddleware, validate(projectSchemas.projectFileIdSchema), checkAccessProject, reindexFile);

/**
 * @swagger
 * /accelerator/projects/{projectId}/files/{fileId}/processing-status:
 *   get:
 *     tags: [Accelerator / Files]
 *     summary: Статус обработки и индексирования файла
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Статус обработки файла }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект или файл не найден }
 */
router.get('/:projectId/files/:fileId/processing-status', authMiddleware, validate(projectSchemas.projectFileIdSchema), checkAccessProject, getFileProcessingStatus);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-route:
 *   get:
 *     tags: [Accelerator / Expert Route]
 *     summary: Текущий агент и маршрут проекта
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Маршрут получен }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект не найден }
 */
router.get('/:projectId/expert-route', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, getExpertRoute);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions:
 *   post:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Создать (или продолжить активную) экспертную сессию для агента
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId]
 *             properties:
 *               agentId: { type: string }
 *     responses:
 *       201: { description: Сессия создана или найдена активная }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект или агент не найден }
 *       409: { description: Агент сейчас недоступен в маршруте проекта (AGENT_NOT_CURRENT) }
 */
router.post('/:projectId/expert-sessions', authMiddleware, validate(expertSessionSchemas.createSessionSchema), checkAccessProject, createExpertSession);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions/{sessionId}/messages:
 *   post:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Отправить сообщение агенту
 *     description: Сервер собирает контекст (summary проекта, системный промпт агента, релевантные фрагменты из Qdrant, отфильтрованные по projectId) и вызывает LLM. Клиент никогда не обращается к LLM/Qdrant напрямую.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200: { description: Сообщение обработано, возвращены userMessage и assistantMessage }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект или сессия не найдена }
 *       409: { description: Сессия уже завершена }
 */
router.post('/:projectId/expert-sessions/:sessionId/messages', authMiddleware, validate(expertSessionSchemas.sendMessageSchema), checkAccessProject, sendExpertMessage);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions/{sessionId}/complete:
 *   post:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Завершить этап и создать/подтвердить артефакт
 *     description: |
 *       Двухфазное завершение: без confirmArtifact создаётся черновик артефакта
 *       (status=ready) и сессия переходит в waiting_user_confirmation, но проект
 *       не переключается на следующего агента. С confirmArtifact=true артефакт
 *       подтверждается (status=confirmed), индексируется в Qdrant, summary проекта
 *       обновляется и currentAgentId переключается на nextAgentId агента.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirmArtifact: { type: boolean, default: false }
 *     responses:
 *       200: { description: Артефакт создан/подтверждён }
 *       401: { description: Требуется авторизация }
 *       403: { description: Нет доступа к проекту }
 *       404: { description: Проект или сессия не найдена }
 *       409: { description: Сессия уже завершена }
 *       422: { description: Артефакт не прошёл валидацию (ARTIFACT_VALIDATION_FAILED) }
 */
router.post('/:projectId/expert-sessions/:sessionId/complete', authMiddleware, validate(expertSessionSchemas.completeSessionSchema), checkAccessProject, completeExpertSession);

export default router;
