import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import agentSchemas from '../../schemas/course/agent.schema.js';
import { createAgent } from '../../controllers/course/agent/create-agent.controller.js';
import { getAgent } from '../../controllers/course/agent/get-agent.controller.js';
import { listAgents } from '../../controllers/course/agent/list-agents.controller.js';
import { updateAgent } from '../../controllers/course/agent/update-agent.controller.js';
import { deleteAgent } from '../../controllers/course/agent/delete-agent.controller.js';
import { listOpenAiAssistants } from '../../controllers/course/agent/list-assistants.controller.js';
import { accessibleAgents } from '../../controllers/course/agent/accessible-agents.controller.js';

const router = express.Router();

/**
 * @swagger
 * /course/agents/assistants:
 *   get:
 *     tags: [Course / Agents]
 *     summary: Список ассистентов OpenAI
 *     description: Возвращает id и имя каждого ассистента из OpenAI для привязки к агенту. Требует одно из прав `course_agents.read`, `course_agents.create`, `course_agents.update`.
 *     responses:
 *       200:
 *         description: Список ассистентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OpenAiAssistant'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/assistants', authMiddleware, checkPermission(['course_agents.read', 'course_agents.create', 'course_agents.update'], 'any'), listOpenAiAssistants);

/**
 * @swagger
 * /course/agents/accessible:
 *   get:
 *     tags: [Course / Agents]
 *     summary: Доступные агенты текущего пользователя
 *     description: Возвращает агентов из активной группы пользователя. Не требует прав администратора.
 *     responses:
 *       200:
 *         description: Список доступных агентов (пустой массив, если нет группы или группа неактивна)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CourseAgent'
 */
router.get('/accessible', authMiddleware, accessibleAgents);

/**
 * @swagger
 * /course/agents:
 *   get:
 *     tags: [Course / Agents]
 *     summary: Список всех агентов
 *     description: Требует право `agents.read`.
 *     responses:
 *       200:
 *         description: Список агентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CourseAgent'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('course_agents.read'), listAgents);

/**
 * @swagger
 * /course/agents:
 *   post:
 *     tags: [Course / Agents]
 *     summary: Создать агента
 *     description: Требует право `agents.create`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, avatar, openAiAssistantId]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               role:
 *                 type: string
 *                 maxLength: 100
 *                 description: Роль агента (например, "Ментор", "Куратор")
 *               avatar:
 *                 type: string
 *                 format: uri
 *               openAiAssistantId:
 *                 type: string
 *               baseMessages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Агент создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseAgent'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('course_agents.create'), validate(agentSchemas.createAgentSchema), createAgent);

/**
 * @swagger
 * /course/agents/{id}:
 *   get:
 *     tags: [Course / Agents]
 *     summary: Получить агента по ID
 *     description: Требует право `agents.read`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Агент получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseAgent'
 *       404:
 *         description: Агент не найден
 */
router.get('/:id', authMiddleware, checkPermission('course_agents.read'), validate(agentSchemas.agentIdSchema), getAgent);

/**
 * @swagger
 * /course/agents/{id}:
 *   put:
 *     tags: [Course / Agents]
 *     summary: Обновить агента
 *     description: Требует право `agents.update`.
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
 *               description:
 *                 type: string
 *               role:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 description: Роль агента (например, "Ментор", "Куратор")
 *               avatar:
 *                 type: string
 *                 format: uri
 *               openAiAssistantId:
 *                 type: string
 *               baseMessages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Агент обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CourseAgent'
 *       404:
 *         description: Агент не найден
 */
router.put('/:id', authMiddleware, checkPermission('course_agents.update'), validate(agentSchemas.updateAgentSchema), updateAgent);

/**
 * @swagger
 * /course/agents/{id}:
 *   delete:
 *     tags: [Course / Agents]
 *     summary: Удалить агента
 *     description: Требует право `agents.delete`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Агент удалён
 *       404:
 *         description: Агент не найден
 */
router.delete('/:id', authMiddleware, checkPermission('course_agents.delete'), validate(agentSchemas.agentIdSchema), deleteAgent);

export default router;
