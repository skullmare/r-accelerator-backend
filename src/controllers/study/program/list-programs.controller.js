import StudyProgram from '../../../models/study/program.model.js';

export async function listPrograms(req, res) {
    try {
        // без популяции items — для списка достаточно мета-данных программы
        const programs = await StudyProgram.find({}, 'name title subtitle description tags cover sequential active qrCode createdAt');
        return res.success(programs, 'Список программ получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении программ');
    }
}
