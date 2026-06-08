import crypto from 'crypto';
import StudyProgram from '../../../models/study/program.model.js';

export async function updateProgram(req, res) {
    try {
        const { programId } = req.validatedData.params;
        const { updateQRCode, ...rest } = req.validatedData.body;

        if (updateQRCode) rest.qrCode = crypto.randomBytes(32).toString('hex');

        const program = await StudyProgram.findByIdAndUpdate(programId, rest, { returnDocument: 'after' });
        if (!program) return res.error({}, 404, 'Программа не найдена');
        return res.success(program, 'Программа обновлена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении программы');
    }
}
