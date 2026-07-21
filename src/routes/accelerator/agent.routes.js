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
 *     description: Только для пользователей с правом accelerator_agents.manage (или superadmin). Возвращает агентов вместе с systemPrompt и completionCriteria — обычные пользователи этот эндпоинт не видят.
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
 *       Агент — универсальная сущность, система не завязана на фиксированный
 *       набор R1-R5. Идентифицируется своим _id (Mongo ObjectId) — отдельного
 *       человекочитаемого кода нет. order определяет последовательность,
 *       nextAgentId — переход после завершения (должен ссылаться на
 *       существующего агента по _id или быть пустым).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, roleTitle, order, systemPrompt, completionCriteria, artifactDefinition]
 *             properties:
 *               name: { type: string, description: "Имя агента для интерфейса." }
 *               roleTitle: { type: string, description: "Короткое описание специализации." }
 *               description: { type: string, nullable: true, description: "Развёрнутое описание агента для UI (в промпт не подмешивается)." }
 *               order: { type: integer, description: "Порядковое место агента в маршруте." }
 *               isActive: { type: boolean, default: true, description: "Если false — агент не участвует в пользовательском маршруте." }
 *               systemPrompt: { type: string, description: "Базовая системная инструкция роли — уходит в LLM при каждом сообщении." }
 *               completionCriteria: { type: string, description: "Когда этап считается завершённым (инструкция для модели, не хард-гейт на сервере)." }
 *               artifactDefinition:
 *                 type: object
 *                 required: [artifactType]
 *                 properties:
 *                   artifactType: { type: string, description: "Тип артефакта, попадает в Artifact.type." }
 *                   titleTemplate: { type: string, nullable: true, description: "Шаблон заголовка артефакта." }
 *                   requiredFields: { type: array, items: { type: string }, description: "Обязательные ключи JSON-артефакта." }
 *                   outputSchema: { type: object, nullable: true, description: "Доп. JSON Schema для строгой валидации." }
 *                   summaryField: { type: string, default: summary, description: "Какое поле артефакта использовать как краткую сводку." }
 *               nextAgentId: { type: string, nullable: true, description: "_id другого агента — куда переключить проект после подтверждения артефакта." }
 *               contextPolicy:
 *                 type: object
 *                 properties:
 *                   includeProjectSummary: { type: boolean, description: "Подмешивать ли Project.contextSummary в промпт." }
 *                   includePreviousArtifacts: { type: boolean, description: "Включать ли артефакты предыдущих этапов в Qdrant-поиск." }
 *                   qdrantTopK: { type: integer, description: "Сколько фрагментов забирать из Qdrant-поиска." }
 *                   maxContextChars: { type: integer, description: "Лимит символов на весь retrieved-контекст." }
 *                   allowedSourceTypes: { type: array, items: { type: string }, description: "Какие типы источников участвуют в поиске." }
 *               modelConfig:
 *                 type: object
 *                 description: Провайдер сейчас всегда OpenAI.
 *                 properties:
 *                   model: { type: string, description: "Модель OpenAI." }
 *                   temperature: { type: number, description: "Температура генерации." }
 *                   maxTokens: { type: integer, description: "Лимит токенов на ответ модели." }
 *               knowledgeIds:
 *                 type: array
 *                 items: { type: string }
 *                 description: "_id глобальных баз знаний (Knowledge), привязанных агенту. Поиск в knowledge_context идёт только по ним."
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
 *         description: Ошибка валидации или nextAgentId не существует
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
 *     description: Позволяет, среди прочего, временно отключить агента полем isActive=false. Все поля запроса опциональны — обновляются только переданные.
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
 *               name: { type: string }
 *               roleTitle: { type: string }
 *               description: { type: string, nullable: true, description: "Развёрнутое описание агента для UI." }
 *               order: { type: integer }
 *               isActive: { type: boolean, description: "false — временно исключить агента из пользовательского маршрута." }
 *               systemPrompt: { type: string }
 *               completionCriteria: { type: string }
 *               artifactDefinition:
 *                 type: object
 *                 properties:
 *                   artifactType: { type: string }
 *                   titleTemplate: { type: string, nullable: true }
 *                   requiredFields: { type: array, items: { type: string } }
 *                   outputSchema: { type: object, nullable: true }
 *                   summaryField: { type: string }
 *               nextAgentId: { type: string, nullable: true, description: "_id следующего агента; должен существовать." }
 *               contextPolicy: { type: object }
 *               modelConfig: { type: object }
 *               knowledgeIds: { type: array, items: { type: string }, description: "_id баз знаний (Knowledge), привязанных агенту." }
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
 *       400: { description: Ошибка валидации или nextAgentId не существует, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Недостаточно прав, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Агент не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.patch('/:agentId', validate(agentSchemas.updateAgentSchema), updateAgent);

export default router;
