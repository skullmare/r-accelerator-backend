import StudyProgram from '../../../models/study/program.model.js';

export async function addModuleItem(req, res) {
    try {
        const { programId, moduleId } = req.validatedData.params;
        const { type, itemId } = req.validatedData.body;

        const program = await StudyProgram.findOneAndUpdate(
            { _id: programId, 'modules._id': moduleId },
            { $push: { 'modules.$.items': { type, item: itemId } } },
            { returnDocument: 'after' }
        );
        if (!program) return res.error({}, 404, 'Программа или модуль не найдены');

        const module = program.modules.find(m => m._id.equals(moduleId));
        const newItem = module.items[module.items.length - 1];
        return res.success(
            { _id: newItem._id, type: newItem.type, itemId: newItem.item },
            'Элемент добавлен в модуль',
            201
        );
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при добавлении элемента в модуль');
    }
}
