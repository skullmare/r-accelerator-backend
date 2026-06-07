import StudyProgram from '../../../models/study/program.model.js';

export async function deleteProgram(req, res) {
    try {
        const { id } = req.validatedData.params;
        const program = await StudyProgram.findByIdAndDelete(id);
        if (!program) return res.error({}, 404, 'Программа не найдена');
        return res.success({}, 'Программа удалена', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при удалении программы');
    }
}
