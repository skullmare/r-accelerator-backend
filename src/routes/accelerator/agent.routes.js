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
 *     summary: Список агентов Акселератора
 *     description: Только для пользователей с правом accelerator_agents.manage (или superadmin). Возвращает агентов вместе с промптами — обычные пользователи этот эндпоинт не видят.
 *     responses:
 *       200:
 *         description: Список агентов, отсортированный по order.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Список агентов получен" }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AcceleratorAgent'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', listAgents);

/**
 * @swagger
 * /accelerator/admin/agents:
 *   post:
 *     tags: [Accelerator / Admin Agents]
 *     summary: Создать агента
 *     description: |
 *       У агента ровно девять полей — больше настраивать нечего. Поведение
 *       задаётся двумя промптами; параметры LLM и сборки контекста общие для
 *       всего сервиса и через API не настраиваются.
 *
 *       Маршрут пользователя — это агенты, отсортированные по `order`.
 *       `nextAgentId` нужен только для нелинейного перехода; для обычного
 *       последовательного маршрута его можно не задавать вовсе.
 *
 *       Подробно — `docs/accelerator/agent-setup.md`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, order, systemPrompt, completionPrompt]
 *             properties:
 *               systemPrompt: { type: string, maxLength: 20000, description: "Основная инструкция агента — уходит в LLM при каждом сообщении и при генерации документа этапа." }
 *               completionPrompt: { type: string, maxLength: 5000, description: "Условие завершения этапа обычным текстом. Агент видит его в промпте и сам вызывает stage_ready, когда условие выполнено." }
 *               knowledgeIds: { type: array, items: { type: string }, description: "_id баз знаний (Knowledge), закреплённых за агентом. Пустой список — агент работает без базы знаний." }
 *               name: { type: string, maxLength: 150, description: "Имя агента для интерфейса." }
 *               description: { type: string, maxLength: 1000, nullable: true, description: "Описание специализации для интерфейса." }
 *               avatarUrl: { type: string, format: uri, nullable: true, description: "Аватарка агента." }
 *               thinkingAvatarUrl: { type: string, format: uri, nullable: true, description: "Аватарка состояния «агент думает»." }
 *               order: { type: integer, description: "Порядковый номер агента в маршруте." }
 *               nextAgentId: { type: string, nullable: true, description: "Необязательное переопределение перехода: _id агента, к которому перейти после этого этапа. По умолчанию — следующий по order." }
 *     responses:
 *       201:
 *         description: Агент создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Агент создан" }
 *                 data:
 *                   $ref: '#/components/schemas/AcceleratorAgent'
 *       400:
 *         description: Ошибка валидации, nextAgentId или knowledgeIds не существуют
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       200:
 *         description: Агент получен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Агент получен" }
 *                 data:
 *                   $ref: '#/components/schemas/AcceleratorAgent'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Недостаточно прав, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Агент не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:agentId', validate(agentSchemas.agentIdSchema), getAgent);

/**
 * @swagger
 * /accelerator/admin/agents/{agentId}:
 *   patch:
 *     tags: [Accelerator / Admin Agents]
 *     summary: Обновить агента
 *     description: Все поля запроса опциональны — обновляются только переданные.
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               systemPrompt: { type: string, maxLength: 20000 }
 *               completionPrompt: { type: string, maxLength: 5000 }
 *               knowledgeIds: { type: array, items: { type: string } }
 *               name: { type: string, maxLength: 150 }
 *               description: { type: string, maxLength: 1000, nullable: true }
 *               avatarUrl: { type: string, format: uri, nullable: true }
 *               thinkingAvatarUrl: { type: string, format: uri, nullable: true }
 *               order: { type: integer }
 *               nextAgentId: { type: string, nullable: true, description: "Должен ссылаться на существующего агента и не на самого себя." }
 *     responses:
 *       200:
 *         description: Агент обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Агент обновлён" }
 *                 data:
 *                   $ref: '#/components/schemas/AcceleratorAgent'
 *       400: { description: "Ошибка валидации, несуществующий nextAgentId/knowledgeIds или самоссылка (NEXT_AGENT_SELF_REFERENCE)", content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Недостаточно прав, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Агент не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.patch('/:agentId', validate(agentSchemas.updateAgentSchema), updateAgent);

export default router;
