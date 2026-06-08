import User from '../models/user.model.js';
import StudyProgram from '../models/study/program.model.js';

async function checkAccessAgent(req, res, next) {
    const { agentId } = req.params;
    const user = await User.findById(req.user.id, 'studyPrograms');

    const program = await StudyProgram.findOne({
        _id: { $in: user?.studyPrograms ?? [] },
        'modules.items': { $elemMatch: { item: agentId, type: 'StudyAgent' } }
    }, '_id');

    if (!program) {
        return res.error({}, 403, 'Нет доступа к агенту');
    }

    req.program = program;
    next();
}

export default checkAccessAgent;
