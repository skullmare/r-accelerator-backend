import StudyProgram from '../models/study/program.model.js';

async function checkStatusProgram(req, res, next) {
    const { programId } = req.query;

    const program = await StudyProgram.findById(programId, 'active');

    if (!program) {
        return res.error({}, 404, 'Программа обучения не найдена');
    }

    if (!program.active) {
        return res.error({}, 403, 'Программа обучения неактивна');
    }

    next();
}

export default checkStatusProgram;
