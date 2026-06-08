import z from 'zod';

const listFilesSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        source: z.enum(['user', 'system']).optional()
    })
});

export default { listFilesSchema };
