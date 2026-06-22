import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const createAgentSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        role: z.string().min(1).max(100).optional(),
        avatar: z.string().url(),
        openAiAssistantId: z.string().min(1),
    })
});

const updateAgentSchema = z.object({
    params: z.object({ id: objectId }),
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(500).optional(),
        role: z.string().min(1).max(100).nullable().optional(),
        avatar: z.string().url().optional(),
        openAiAssistantId: z.string().min(1).optional()
    })
});

const agentIdSchema = z.object({
    params: z.object({ id: objectId })
});

// GET /study/programs/:programId/agents/:agentId — получение агента с проверкой доступа (user)
const getProgressAgentSchema = z.object({
    params: z.object({ programId: objectId, agentId: objectId })
});

export default { createAgentSchema, updateAgentSchema, agentIdSchema, getProgressAgentSchema };
