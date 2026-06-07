import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const createProgramSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        agents: z.array(objectId).optional().default([]),
        active: z.boolean().optional().default(true)
    })
});

const updateProgramSchema = z.object({
    params: z.object({ id: objectId }),
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        agents: z.array(objectId).optional(),
        active: z.boolean().optional(),
        updateQRCode: z.boolean().optional()
    })
});

const programIdSchema = z.object({
    params: z.object({ id: objectId })
});

const addToProgramSchema = z.object({
    body: z.object({
        qrCode: z.string().min(1)
    })
});

export default { createProgramSchema, updateProgramSchema, programIdSchema, addToProgramSchema };
