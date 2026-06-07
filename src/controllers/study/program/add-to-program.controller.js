import StudyProgram from '../../../models/study/program.model.js';
import User from '../../../models/user.model.js';

export async function addToProgram(req, res) {
    try {
        const { qrCode } = req.validatedData.body;

        const program = await StudyProgram.findOne({ qrCode });
        if (!program) return res.error({}, 404, 'Программа не найдена');

        await User.findByIdAndUpdate(req.user.id, { studyProgram: program._id });
        return res.success({ programId: program._id }, 'Вы добавлены в программу', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при вступлении в программу');
    }
}
