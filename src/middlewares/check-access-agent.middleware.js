import StudyProgram from '../models/study/program.model.js';

async function checkAccessAgent(req, res, next) {
    const { agentId, programId } = req.params;

    const program = await StudyProgram.findOne({
        _id: programId,
        'modules.items': { $elemMatch: { item: agentId, type: 'StudyAgent' } }
    }, '_id');

    if (!program) {
        return res.error({}, 403, 'Нет доступа к агенту');
    }

    req.program = program;
    next();
}

export default checkAccessAgent;
