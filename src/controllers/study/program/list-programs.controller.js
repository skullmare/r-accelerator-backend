import StudyProgram from '../../../models/study/program.model.js';

export async function listPrograms(req, res) {
    try {
        const programs = await StudyProgram.find().populate('agents');
        return res.success(programs, 'Список программ получен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении программ');
    }
}
