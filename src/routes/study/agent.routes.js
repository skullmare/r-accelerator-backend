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

const router = express.Router();

// список ассистентов OpenAI для привязки к агенту при создании/редактировании
router.get('/assistants', authMiddleware, checkPermission(['study_agents.read', 'study_agents.create', 'study_agents.update'], 'any'), listOpenAiAssistants);

// список всех агентов — для выбора при составлении программы
router.get('/', authMiddleware, checkPermission('study_agents.read'), listAgents);

// создать агента и привязать к OpenAI-ассистенту
router.post('/', authMiddleware, checkPermission('study_agents.create'), validate(agentSchemas.createAgentSchema), createAgent);

// получить агента по ID
router.get('/:id', authMiddleware, checkPermission('study_agents.read'), validate(agentSchemas.agentIdSchema), getAgent);

// обновить данные агента
router.patch('/:id', authMiddleware, checkPermission('study_agents.update'), validate(agentSchemas.updateAgentSchema), updateAgent);

// удалить агента
router.delete('/:id', authMiddleware, checkPermission('study_agents.delete'), validate(agentSchemas.agentIdSchema), deleteAgent);

export default router;
