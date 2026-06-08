import User from '../models/user.model.js';

async function checkAccessProgram(req, res, next) {
    const { programId } = req.query;
    const user = await User.findById(req.user.id, 'studyPrograms');

    const hasAccess = user?.studyPrograms?.some(id => id.equals(programId));

    if (!hasAccess) {
        return res.error({}, 403, 'Нет доступа к программе обучения');
    }

    next();
}

export default checkAccessProgram;
