import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

// POST /study/lesson-groups — создание группы уроков (admin)
const createLessonGroupSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100)
    })
});

// PATCH /study/lesson-groups/:groupId — переименование группы (admin)
const updateLessonGroupSchema = z.object({
    params: z.object({ groupId: objectId }),
    body: z.object({
        name: z.string().min(1).max(100)
    })
});

// GET/DELETE /study/lesson-groups/:groupId (admin)
const lessonGroupIdSchema = z.object({
    params: z.object({ groupId: objectId })
});

export default {
    createLessonGroupSchema,
    updateLessonGroupSchema,
    lessonGroupIdSchema
};
