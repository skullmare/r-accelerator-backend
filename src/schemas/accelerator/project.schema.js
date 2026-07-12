import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const PROJECT_STAGES = ['idea', 'mvp', 'launched', 'growth', 'scale'];
const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'];

// POST /accelerator/projects — создание проекта (user)
// ownerId и progress выставляются бэкендом, не принимаются от клиента
const createProjectSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1).max(150),
        description: z.string().trim().max(2000).nullable().optional(),
        userRole: z.string().trim().max(150).nullable().optional(),
        industry: z.string().trim().max(150).nullable().optional(),
        businessSpecifics: z.string().trim().max(2000).nullable().optional(),
        stage: z.enum(PROJECT_STAGES).optional(),
        goal: z.string().trim().max(1000).nullable().optional(),
        status: z.enum(PROJECT_STATUSES).optional()
    }).strict()
});

// PATCH /accelerator/projects/:projectId — обновление проекта (user)
// ownerId и progress выставляются бэкендом, не принимаются от клиента
const updateProjectSchema = z.object({
    params: z.object({ projectId: objectId }),
    body: z.object({
        name: z.string().trim().min(1).max(150).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        userRole: z.string().trim().max(150).nullable().optional(),
        industry: z.string().trim().max(150).nullable().optional(),
        businessSpecifics: z.string().trim().max(2000).nullable().optional(),
        stage: z.enum(PROJECT_STAGES).optional(),
        goal: z.string().trim().max(1000).nullable().optional(),
        status: z.enum(PROJECT_STATUSES).optional()
    }).strict()
});

// GET /accelerator/projects/:projectId, DELETE /accelerator/projects/:projectId — получение и удаление проекта (user)
const projectIdSchema = z.object({
    params: z.object({ projectId: objectId })
});

// /accelerator/projects/:projectId/files/:fileId/* — файл в контексте проекта (user)
const projectFileIdSchema = z.object({
    params: z.object({ projectId: objectId, fileId: objectId })
});

export default { createProjectSchema, updateProjectSchema, projectIdSchema, projectFileIdSchema };
