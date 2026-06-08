import StudyProgram from '../../../models/study/program.model.js';

export async function deleteModule(req, res) {
    try {
        const { programId, moduleId } = req.validatedData.params;
        // удаляем модуль из массива modules по его _id
        const program = await StudyProgram.findByIdAndUpdate(
            programId,
            { $pull: { modules: { _id: moduleId } } },
            { returnDocument: 'after' }
        );
        if (!program) return res.error({}, 404, 'Программа не найдена');
        return res.success({}, 'Модуль удалён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при удалении модуля');
    }
}
