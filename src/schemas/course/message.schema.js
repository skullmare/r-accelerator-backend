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
        agentId: objectId
    })
});

export default { createMessageSchema, listMessagesSchema };
