import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

// POST /study/programs/:programId/agents/:agentId/messages — отправка сообщения агенту (user)
const createMessageSchema = z.object({
    params: z.object({ programId: objectId, agentId: objectId }),
    body: z.object({
        messageText: z.string().min(1).max(4000)
    })
});

// GET /study/programs/:programId/agents/:agentId/messages — получение истории сообщений с агентом (user)
const listMessagesSchema = z.object({
    params: z.object({ programId: objectId, agentId: objectId }),
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10)
    })
});

export default { createMessageSchema, listMessagesSchema };
