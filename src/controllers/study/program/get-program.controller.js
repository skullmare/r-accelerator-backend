import StudyProgram from '../../../models/study/program.model.js';

export async function getProgram(req, res) {
    try {
        const { id } = req.validatedData.params;
        const program = await StudyProgram.findById(id).populate('agents');
        if (!program) return res.error({}, 404, 'Программа не найдена');
        return res.success(program, 'Программа получена', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении программы');
    }
}
