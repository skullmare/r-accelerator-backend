import StudyProgram from '../../../models/study/program.model.js';

export async function addModule(req, res) {
    try {
        const { programId } = req.validatedData.params;
        const { name } = req.validatedData.body;
        // добавляем новый модуль в конец массива modules программы
        const program = await StudyProgram.findByIdAndUpdate(
            programId,
            { $push: { modules: { name, items: [] } } },
            { returnDocument: 'after' }
        );
        if (!program) return res.error({}, 404, 'Программа не найдена');
        const newModule = program.modules[program.modules.length - 1];
        return res.success(newModule, 'Модуль добавлен', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при добавлении модуля');
    }
}
