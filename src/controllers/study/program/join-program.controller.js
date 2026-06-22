import StudyProgram from '../../../models/study/program.model.js';
import User from '../../../models/user.model.js';

export async function joinProgram(req, res) {
    try {
        const { qrCode } = req.validatedData.body;

        const program = await StudyProgram.findOne({ qrCode, active: true });
        if (!program) return res.error({}, 404, 'Программа не найдена');

        // добавляем программу в массив studyPrograms пользователя если её там ещё нет
        await User.findByIdAndUpdate(req.user.id, { $addToSet: { studyPrograms: program._id } });
        return res.success({ programId: program._id }, 'Вы добавлены в программу', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при вступлении в программу');
    }
}
