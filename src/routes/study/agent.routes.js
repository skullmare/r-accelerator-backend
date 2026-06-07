import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import agentSchemas from '../../schemas/study/agent.schema.js';
import { createAgent } from '../../controllers/study/agent/create-agent.controller.js';
import { getAgent } from '../../controllers/study/agent/get-agent.controller.js';
import { listAgents } from '../../controllers/study/agent/list-agents.controller.js';
import { updateAgent } from '../../controllers/study/agent/update-agent.controller.js';
import { deleteAgent } from '../../controllers/study/agent/delete-agent.controller.js';
import { listOpenAiAssistants } from '../../controllers/study/agent/list-assistants.controller.js';
import { accessibleAgents } from '../../controllers/study/agent/accessible-agents.controller.js';

const router = express.Router();

/**
 * @swagger
 * /study/agents/assistants:
 *   get:
 *     tags: [Study / Agents]
 *     summary: Список ассистентов OpenAI
 *     description: Возвращает id и имя каждого ассистента из OpenAI для привязки к агенту. Требует одно из прав `study_agents.read`, `study_agents.create`, `study_agents.update`.
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
router.get('/assistants', authMiddleware, checkPermission(['study_agents.read', 'study_agents.create', 'study_agents.update'], 'any'), listOpenAiAssistants);

/**
 * @swagger
 * /study/agents/accessible:
 *   get:
 *     tags: [Study / Agents]
 *     summary: Доступные агенты текущего пользователя
 *     description: Возвращает агентов из активной программы пользователя.
 *     responses:
 *       200:
 *         description: Список доступных агентов (пустой массив, если нет программы или программа неактивна)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudyAgent'
 */
router.get('/accessible', authMiddleware, accessibleAgents);

/**
 * @swagger
 * /study/agents:
 *   get:
 *     tags: [Study / Agents]
 *     summary: Список всех агентов
 *     description: Требует право `study_agents.read`.
 *     responses:
 *       200:
 *         description: Список агентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudyAgent'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('study_agents.read'), listAgents);

/**
 * @swagger
 * /study/agents:
 *   post:
 *     tags: [Study / Agents]
 *     summary: Создать агента
 *     description: Требует право `study_agents.create`.
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
 *               $ref: '#/components/schemas/StudyAgent'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('study_agents.create'), validate(agentSchemas.createAgentSchema), createAgent);

/**
 * @swagger
 * /study/agents/{id}:
 *   get:
 *     tags: [Study / Agents]
 *     summary: Получить агента по ID
 *     description: Требует право `study_agents.read`.
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
 *               $ref: '#/components/schemas/StudyAgent'
 *       404:
 *         description: Агент не найден
 */
router.get('/:id', authMiddleware, checkPermission('study_agents.read'), validate(agentSchemas.agentIdSchema), getAgent);

/**
 * @swagger
 * /study/agents/{id}:
 *   put:
 *     tags: [Study / Agents]
 *     summary: Обновить агента
 *     description: Требует право `study_agents.update`.
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
 *               $ref: '#/components/schemas/StudyAgent'
 *       404:
 *         description: Агент не найден
 */
router.put('/:id', authMiddleware, checkPermission('study_agents.update'), validate(agentSchemas.updateAgentSchema), updateAgent);

/**
 * @swagger
 * /study/agents/{id}:
 *   delete:
 *     tags: [Study / Agents]
 *     summary: Удалить агента
 *     description: Требует право `study_agents.delete`.
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
router.delete('/:id', authMiddleware, checkPermission('study_agents.delete'), validate(agentSchemas.agentIdSchema), deleteAgent);

export default router;
