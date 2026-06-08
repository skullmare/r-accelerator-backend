import User from '../models/user.model.js';
import StudyProgram from '../models/study/program.model.js';

async function checkAccessLesson(req, res, next) {
    const { lessonId } = req.params;
    const user = await User.findById(req.user.id, 'studyPrograms');

    const program = await StudyProgram.findOne({
        _id: { $in: user?.studyPrograms ?? [] },
        'modules.items': { $elemMatch: { item: lessonId, type: 'StudyLesson' } }
    }, '_id');

    if (!program) {
        return res.error({}, 403, 'Нет доступа к уроку');
    }

    req.program = program;
    next();
}

export default checkAccessLesson;
