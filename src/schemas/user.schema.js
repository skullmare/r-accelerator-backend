import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const listUsersSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        email: z.string().email('Некорректный формат email').optional()
    })
});

const userIdSchema = z.object({
    params: z.object({ id: objectId })
});

const updateUserSchema = z.object({
    params: z.object({ id: objectId }),
    body: z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        profession: z.string().min(1).max(200).optional(),
        fieldOfActivity: z.string().min(1).max(200).optional(),
        city: z.string().min(1).max(100).optional(),
        studyProgram: objectId.nullable().optional()
    })
});

const updateUserRoleSchema = z.object({
    params: z.object({ id: objectId }),
    body: z.object({
        role: objectId.nullable()
    })
});

export default { listUsersSchema, userIdSchema, updateUserSchema, updateUserRoleSchema };
