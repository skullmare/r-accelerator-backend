import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

// POST /study/lessons — создание урока (admin)
const createLessonSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        cover: z.string().url().nullable().optional().default(null),
        group: objectId.nullable().optional().default(null),
        content: z.any(),
        video: z.object({ url: z.string().url() }).optional(),
        presentation: z.object({ url: z.string().url() }).optional()
    })
});

// PATCH /study/lessons/:lessonId — обновление урока (admin)
const updateLessonSchema = z.object({
    params: z.object({ lessonId: objectId }),
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        cover: z.string().url().nullable().optional(),
        group: objectId.nullable().optional(),
        content: z.any().optional(),
        video: z.object({ url: z.string().url() }).nullable().optional(),
        presentation: z.object({ url: z.string().url() }).nullable().optional()
    })
});

// GET /study/lessons/:lessonId, DELETE /study/lessons/:lessonId — получение и удаление урока (admin)
const lessonIdSchema = z.object({
    params: z.object({ lessonId: objectId })
});

// GET /study/programs/:programId/lessons/:lessonId — получение урока с ответами пользователя из прогресса (user)
const getLessonWithProgressSchema = z.object({
    params: z.object({ programId: objectId, lessonId: objectId })
});

// POST /study/programs/:programId/lessons/:lessonId/complete — отметить урок пройденным (user)
const completeLessonSchema = z.object({
    params: z.object({ programId: objectId, lessonId: objectId })
});

export default {
    createLessonSchema,
    updateLessonSchema,
    lessonIdSchema,
    getLessonWithProgressSchema,
    completeLessonSchema
};
