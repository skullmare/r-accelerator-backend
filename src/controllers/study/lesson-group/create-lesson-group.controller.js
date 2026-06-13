import LessonGroup from '../../../models/study/lesson-group.model.js';

export async function createLessonGroup(req, res) {
    try {
        const { name } = req.validatedData.body;
        const group = await LessonGroup.create({ name });
        return res.success(group, 'Группа создана', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании группы');
    }
}
