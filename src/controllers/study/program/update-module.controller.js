import StudyProgram from '../../../models/study/program.model.js';

export async function updateModule(req, res) {
    try {
        const { programId, moduleId } = req.validatedData.params;
        const { name } = req.validatedData.body;
        // обновляем поле name конкретного модуля по его _id через positional operator
        const program = await StudyProgram.findOneAndUpdate(
            { _id: programId, 'modules._id': moduleId },
            { $set: { 'modules.$.name': name } },
            { returnDocument: 'after' }
        );
        if (!program) return res.error({}, 404, 'Программа или модуль не найдены');
        const updatedModule = program.modules.find(m => m._id.equals(moduleId));
        return res.success(updatedModule, 'Модуль обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении модуля');
    }
}
