import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const listFilesSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        source: z.enum(['user', 'system']).optional(),
        projectId: objectId.optional()
    })
});

const initiateUploadSchema = z.object({
    body: z.object({
        filename: z.string().min(1),
        mimetype: z.string().min(1),
        size: z.number().int().positive(),
    })
});

const presignUploadSchema = z.object({
    body: z.object({
        uploadId: z.string().min(1),
        key: z.string().min(1),
        partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(10000),
    })
});

const completeUploadSchema = z.object({
    body: z.object({
        uploadId: z.string().min(1),
        key: z.string().min(1),
        parts: z.array(z.object({
            PartNumber: z.number().int().min(1),
            ETag: z.string().min(1),
        })).min(1),
        originalname: z.string().min(1),
        mimetype: z.string().min(1),
        size: z.number().int().positive(),
        projectId: objectId.nullable().optional(),
    })
});

const abortUploadSchema = z.object({
    body: z.object({
        uploadId: z.string().min(1),
        key: z.string().min(1),
    })
});

export default { listFilesSchema, initiateUploadSchema, presignUploadSchema, completeUploadSchema, abortUploadSchema };
