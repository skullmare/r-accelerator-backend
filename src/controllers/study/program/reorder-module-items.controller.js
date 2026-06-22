import StudyProgram from '../../../models/study/program.model.js';

export async function reorderModuleItems(req, res) {
    try {
        const { programId, moduleId } = req.validatedData.params;
        const { items } = req.validatedData.body;
        // полностью заменяем массив items модуля новым порядком элементов
        const program = await StudyProgram.findOneAndUpdate(
            { _id: programId, 'modules._id': moduleId },
            { $set: { 'modules.$.items': items } },
            { returnDocument: 'after' }
        );
        if (!program) return res.error({}, 404, 'Программа или модуль не найдены');
        const updatedModule = program.modules.find(m => m._id.equals(moduleId));
        return res.success(updatedModule.items, 'Порядок элементов обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при изменении порядка элементов');
    }
}
