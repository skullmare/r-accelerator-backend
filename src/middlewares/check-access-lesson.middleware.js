import StudyProgram from '../models/study/program.model.js';

async function checkAccessLesson(req, res, next) {
    const { lessonId, programId } = req.params;

    const program = await StudyProgram.findOne({
        _id: programId,
        'modules.items': { $elemMatch: { item: lessonId, type: 'StudyLesson' } }
    }, '_id');

    if (!program) {
        return res.error({}, 403, 'Нет доступа к уроку');
    }

    req.program = program;
    next();
}

export default checkAccessLesson;
