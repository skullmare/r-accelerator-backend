import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

// Ровно один источник: fileId (уже загруженный File) ИЛИ sourceUrl
// (внешняя ссылка). Оба сразу или ни одного — ошибка.
function exactlyOneSource(data, ctx) {
    const hasFile = Boolean(data.fileId);
    const hasUrl = Boolean(data.sourceUrl);
    if (hasFile === hasUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Нужно указать ровно один источник: либо fileId, либо sourceUrl',
            path: ['fileId']
        });
    }
}

// POST /accelerator/admin/knowledge — создание knowledge
const createKnowledgeSchema = z.object({
    body: z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).nullable().optional(),
        fileId: objectId.optional(),
        sourceUrl: z.string().trim().url('sourceUrl должен быть корректным URL').optional()
    }).strict().superRefine(exactlyOneSource)
});

// PATCH /accelerator/admin/knowledge/:knowledgeId — обновление метаданных.
// Смена источника не поддерживается точечным патчем — для переиндексации из
// нового источника используйте reindex с новым источником (или пересоздание).
const updateKnowledgeSchema = z.object({
    params: z.object({ knowledgeId: objectId }),
    body: z.object({
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2000).nullable().optional()
    }).strict()
});

// POST /accelerator/admin/knowledge/:knowledgeId/reindex — повторная
// векторизация. Опционально можно переопределить источник.
const reindexKnowledgeSchema = z.object({
    params: z.object({ knowledgeId: objectId }),
    body: z.object({
        fileId: objectId.optional(),
        sourceUrl: z.string().trim().url('sourceUrl должен быть корректным URL').optional()
    }).strict()
});

const knowledgeIdSchema = z.object({
    params: z.object({ knowledgeId: objectId })
});

export default { createKnowledgeSchema, updateKnowledgeSchema, reindexKnowledgeSchema, knowledgeIdSchema };
