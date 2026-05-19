import z from 'zod';
import { ALL_PERMISSIONS } from '../constants/permissions.constants.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');
const permission = z.string().refine(p => ALL_PERMISSIONS.includes(p), 'Недопустимое право');

const createRoleSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        permissions: z.array(permission).min(1)
    })
});

const updateRoleSchema = z.object({
    params: z.object({ id: objectId }),
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        permissions: z.array(permission).min(1).optional()
    })
});

const roleIdSchema = z.object({
    params: z.object({ id: objectId })
});

export default { createRoleSchema, updateRoleSchema, roleIdSchema };
