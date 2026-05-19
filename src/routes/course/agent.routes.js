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

const router = express.Router();

router.get('/assistants', authMiddleware, checkPermission('assistants.read'), listOpenAiAssistants);
router.get('/', authMiddleware, checkPermission('agents.read'), listAgents);
router.post('/', authMiddleware, checkPermission('agents.create'), validate(agentSchemas.createAgentSchema), createAgent);
router.get('/:id', authMiddleware, checkPermission('agents.read'), validate(agentSchemas.agentIdSchema), getAgent);
router.put('/:id', authMiddleware, checkPermission('agents.update'), validate(agentSchemas.updateAgentSchema), updateAgent);
router.delete('/:id', authMiddleware, checkPermission('agents.delete'), validate(agentSchemas.agentIdSchema), deleteAgent);

export default router;
