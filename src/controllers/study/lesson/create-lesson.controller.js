import StudyLesson from '../../../models/study/lesson.model.js';

export async function createLesson(req, res) {
    try {
        const { name, cover, group, content, video, presentation, questions } = req.validatedData.body;
        const lesson = await StudyLesson.create({ name, cover, group, content, video, presentation, questions });
        return res.success(lesson, 'Урок создан', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании урока');
    }
}
