import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const createSessionSchema = z.object({
    params: z.object({ projectId: objectId }),
    body: z.object({ agentId: objectId }).strict()
});

const sessionIdSchema = z.object({
    params: z.object({ projectId: objectId, sessionId: objectId })
});

const sendMessageSchema = z.object({
    params: z.object({ projectId: objectId, sessionId: objectId }),
    body: z.object({ content: z.string().trim().min(1).max(20000) }).strict()
});

const completeSessionSchema = z.object({
    params: z.object({ projectId: objectId, sessionId: objectId }),
    body: z.object({ confirmArtifact: z.boolean().default(false) }).strict()
});

export default { createSessionSchema, sessionIdSchema, sendMessageSchema, completeSessionSchema };
