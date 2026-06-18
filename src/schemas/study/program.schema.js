import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const moduleItemSchema = z.object({
    type: z.enum(['StudyLesson', 'StudyAgent']),
    item: objectId
});

// POST /study/programs — создание программы обучения (admin)
const createProgramSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(2000).nullable().optional().default(null),
        coverMeta: z.record(z.any()).nullable().optional().default(null),
        cover: z.string().url().nullable().optional().default(null),
        sequential: z.boolean().optional().default(true),
        active: z.boolean().optional().default(true)
    })
});

// PATCH /study/programs/:programId — обновление полей программы обучения (admin)
const updateProgramSchema = z.object({
    params: z.object({ programId: objectId }),
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(2000).nullable().optional(),
        coverMeta: z.record(z.any()).nullable().optional(),
        cover: z.string().url().nullable().optional(),
        sequential: z.boolean().optional(),
        active: z.boolean().optional(),
        updateQRCode: z.boolean().optional()
    })
});

// GET /study/programs/:programId, DELETE /study/programs/:programId — получение и удаление программы (admin)
const programIdSchema = z.object({
    params: z.object({ programId: objectId })
});

// POST /study/programs/:programId/modules — добавление модуля в программу (admin)
const addModuleSchema = z.object({
    params: z.object({ programId: objectId }),
    body: z.object({
        name: z.string().min(1).max(100)
    })
});

// PATCH /study/programs/:programId/modules/:moduleId — переименование модуля (admin)
const updateModuleSchema = z.object({
    params: z.object({ programId: objectId, moduleId: objectId }),
    body: z.object({
        name: z.string().min(1).max(100)
    })
});

// DELETE /study/programs/:programId/modules/:moduleId — удаление модуля из программы (admin)
const deleteModuleSchema = z.object({
    params: z.object({ programId: objectId, moduleId: objectId })
});

// POST /study/programs/:programId/modules/:moduleId/items — добавление урока или агента в модуль (admin)
const addModuleItemSchema = z.object({
    params: z.object({ programId: objectId, moduleId: objectId }),
    body: moduleItemSchema
});

// DELETE /study/programs/:programId/modules/:moduleId/items/:itemId — удаление элемента из модуля (admin)
const deleteModuleItemSchema = z.object({
    params: z.object({ programId: objectId, moduleId: objectId, itemId: objectId })
});

// PATCH /study/programs/:programId/modules/:moduleId/items/reorder — изменение порядка элементов в модуле (admin)
const reorderModuleItemsSchema = z.object({
    params: z.object({ programId: objectId, moduleId: objectId }),
    body: z.object({
        items: z.array(moduleItemSchema).min(1)
    })
});

// POST /study/programs/join — вступление пользователя в программу по QR-коду (user)
const joinProgramSchema = z.object({
    body: z.object({
        qrCode: z.string().min(1)
    })
});

// GET /study/programs/:programId/progress — получение программы со смёрженным прогрессом (user)
const programProgressSchema = z.object({
    params: z.object({ programId: objectId })
});

// PATCH /study/programs/:programId/modules/reorder — изменение порядка модулей в программе (admin)
const reorderModulesSchema = z.object({
    params: z.object({ programId: objectId }),
    body: z.object({
        moduleIds: z.array(objectId).min(1)
    })
});

export default {
    createProgramSchema,
    updateProgramSchema,
    programIdSchema,
    addModuleSchema,
    updateModuleSchema,
    deleteModuleSchema,
    addModuleItemSchema,
    deleteModuleItemSchema,
    reorderModuleItemsSchema,
    reorderModulesSchema,
    joinProgramSchema,
    programProgressSchema
};
