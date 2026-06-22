import StudyProgram from '../../../models/study/program.model.js';

export async function getProgram(req, res) {
    try {
        const { programId } = req.validatedData.params;
        // популяция items через refPath — каждый элемент может быть StudyLesson или StudyAgent
        const program = await StudyProgram.findById(programId)
            .populate('modules.items.item');
        if (!program) return res.error({}, 404, 'Программа не найдена');
        return res.success(program, 'Программа получена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении программы');
    }
}
