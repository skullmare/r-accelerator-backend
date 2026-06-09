import crypto from 'crypto';
import StudyProgram from '../../../models/study/program.model.js';

export async function createProgram(req, res) {
    try {
        const { name, cover, sequential, active } = req.validatedData.body;
        const qrCode = crypto.randomBytes(32).toString('hex');
        const program = await StudyProgram.create({ name, cover, sequential, active, qrCode });
        return res.success(program, 'Программа создана', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании программы');
    }
}
