import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import agentSchemas from '../../schemas/accelerator/agent.schema.js';
import { createAgent } from '../../controllers/accelerator/agent/create-agent.controller.js';
import { listAgents } from '../../controllers/accelerator/agent/list-agents.controller.js';
import { getAgent } from '../../controllers/accelerator/agent/get-agent.controller.js';
import { updateAgent } from '../../controllers/accelerator/agent/update-agent.controller.js';

const MANAGE = 'accelerator_agents.manage';
const router = express.Router();

router.use(authMiddleware, checkPermission(MANAGE));

/**
 * @swagger
 * /accelerator/admin/agents:
 *   get:
 *     tags: [Accelerator / Admin Agents]
 *     summary: Список агентов Р-Акселератора
 *     description: Только для пользователей с правом accelerator_agents.manage (или superadmin). Возвращает агентов вместе с systemPrompt и completionCriteria.
 *     responses:
 *       200:
 *         description: Список агентов
 *       401:
 *         description: Требуется авторизация
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', listAgents);

/**
 * @swagger
 * /accelerator/admin/agents:
 *   post:
 *     tags: [Accelerator / Admin Agents]
 *     summary: Создать агента
 *     description: |
 *       Агент — универсальная сущность: code задаётся администратором произвольно
 *       (например "R1", "onboarding-coach"), система не завязана на фиксированный
 *       набор R1-R5. order определяет последовательность, nextAgentCode — переход
 *       после завершения (должен ссылаться на существующий code или быть пустым).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, roleTitle, order, systemPrompt, completionCriteria, artifactDefinition]
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               roleTitle: { type: string }
 *               order: { type: integer }
 *               isActive: { type: boolean, default: true }
 *               systemPrompt: { type: string }
 *               completionCriteria: { type: string }
 *               artifactDefinition:
 *                 type: object
 *                 required: [artifactType]
 *                 properties:
 *                   artifactType: { type: string }
 *                   titleTemplate: { type: string, nullable: true }
 *                   requiredFields: { type: array, items: { type: string } }
 *                   outputSchema: { type: object, nullable: true }
 *                   summaryField: { type: string, default: summary }
 *               nextAgentCode: { type: string, nullable: true }
 *               contextPolicy:
 *                 type: object
 *                 properties:
 *                   includeProjectSummary: { type: boolean }
 *                   includePreviousArtifacts: { type: boolean }
 *                   qdrantTopK: { type: integer }
 *                   maxContextChars: { type: integer }
 *                   allowedSourceTypes: { type: array, items: { type: string } }
 *               modelConfig:
 *                 type: object
 *                 properties:
 *                   provider: { type: string, enum: [openai, openrouter] }
 *                   model: { type: string }
 *                   temperature: { type: number }
 *                   maxTokens: { type: integer }
 *     responses:
 *       201:
 *         description: Агент создан
 *       400:
 *         description: Ошибка валидации или nextAgentCode не существует
 *       401:
 *         description: Требуется авторизация
 *       403:
 *         description: Недостаточно прав
 *       409:
 *         description: code уже используется
 */
router.post('/', validate(agentSchemas.createAgentSchema), createAgent);

/**
 * @swagger
 * /accelerator/admin/agents/{agentId}:
 *   get:
 *     tags: [Accelerator / Admin Agents]
 *     summary: Получить агента по ID
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Агент получен }
 *       401: { description: Требуется авторизация }
 *       403: { description: Недостаточно прав }
 *       404: { description: Агент не найден }
 */
router.get('/:agentId', validate(agentSchemas.agentIdSchema), getAgent);

/**
 * @swagger
 * /accelerator/admin/agents/{agentId}:
 *   patch:
 *     tags: [Accelerator / Admin Agents]
 *     summary: Обновить агента
 *     description: Позволяет, среди прочего, временно отключить агента полем isActive=false.
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Агент обновлён }
 *       400: { description: Ошибка валидации или nextAgentCode не существует }
 *       401: { description: Требуется авторизация }
 *       403: { description: Недостаточно прав }
 *       404: { description: Агент не найден }
 *       409: { description: code уже используется }
 */
router.patch('/:agentId', validate(agentSchemas.updateAgentSchema), updateAgent);

export default router;
