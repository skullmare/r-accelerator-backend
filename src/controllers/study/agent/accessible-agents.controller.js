import User from '../../../models/user.model.js';
import StudyProgram from '../../../models/study/program.model.js';

export async function accessibleAgents(req, res) {
    try {
        const user = await User.findById(req.user.id, 'studyProgram');
        if (!user.studyProgram) return res.success([], 'Доступные агенты получены', 200);

        const program = await StudyProgram.findOne({ _id: user.studyProgram, active: true }).populate('agents');
        if (!program) return res.success([], 'Доступные агенты получены', 200);

        return res.success(program.agents, 'Доступные агенты получены', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при получении доступных агентов');
    }
}
