import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const createMessageSchema = z.object({
    body: z.object({
        agentId: objectId,
        messageText: z.string().min(1).max(4000)
    })
});

const listMessagesSchema = z.object({
    query: z.object({
        agentId: objectId,
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10)
    })
});

export default { createMessageSchema, listMessagesSchema };
