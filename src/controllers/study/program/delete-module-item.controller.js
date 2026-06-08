import StudyProgram from '../../../models/study/program.model.js';

export async function deleteModuleItem(req, res) {
    try {
        const { programId, moduleId, itemId } = req.validatedData.params;
        // удаляем элемент из массива items конкретного модуля по его _id
        const program = await StudyProgram.findOneAndUpdate(
            { _id: programId, 'modules._id': moduleId },
            { $pull: { 'modules.$.items': { _id: itemId } } },
            { returnDocument: 'after' }
        );
        if (!program) return res.error({}, 404, 'Программа или модуль не найдены');
        return res.success({}, 'Элемент удалён из модуля', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при удалении элемента из модуля');
    }
}
