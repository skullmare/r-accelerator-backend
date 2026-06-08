import User from '../models/user.model.js';
import StudyProgram from '../models/study/program.model.js';

async function checkAccessProgram(req, res, next) {
    const { programId } = req.params;
    const user = await User.findById(req.user.id, 'studyPrograms');

    const hasAccess = user?.studyPrograms?.some(id => id.equals(programId));

    if (!hasAccess) {
        return res.error({}, 403, 'Нет доступа к программе обучения');
    }

    const program = await StudyProgram.findById(programId, 'active');

    if (!program.active) {
        return res.error({}, 403, 'Программа обучения неактивна');
    }

    next();
}

export default checkAccessProgram;
