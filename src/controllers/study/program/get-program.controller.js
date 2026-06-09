import StudyProgram from '../../../models/study/program.model.js';

export async function getProgram(req, res) {
    try {
        const { programId } = req.validatedData.params;
        const program = await StudyProgram.findById(programId);
        if (!program) return res.error({}, 404, 'Программа не найдена');

        const data = program.toObject();
        data.modules = data.modules.map(module => ({
            ...module,
            items: module.items.map(({ item, ...rest }) => ({ ...rest, itemId: item }))
        }));

        return res.success(data, 'Программа получена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении программы');
    }
}
