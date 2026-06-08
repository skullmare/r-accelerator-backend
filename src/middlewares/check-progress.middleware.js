import StudyProgram from '../models/study/program.model.js';
import StudyProgress from '../models/study/progress.model.js';

async function checkProgress(req, res, next) {
    const { lessonId } = req.query;
    const programId = req.program?._id;

    const program = await StudyProgram.findById(programId, 'sequential modules.items');

    if (!program) {
        return res.error({}, 404, 'Программа обучения не найдена');
    }

    if (!program.sequential) {
        return next();
    }

    const allItems = program.modules.flatMap(m => m.items);
    const lessonIndex = allItems.findIndex(i => i.item.equals(lessonId));

    if (lessonIndex <= 0) {
        return next();
    }

    const prevItem = allItems[lessonIndex - 1];

    const progress = await StudyProgress.findOne(
        { user: req.user.id, program: programId },
        'completedItems'
    );

    const isPrevCompleted = progress?.completedItems?.some(id => id.equals(prevItem.item));

    if (!isPrevCompleted) {
        return res.error({}, 403, 'Предыдущий элемент программы не пройден');
    }

    next();
}

export default checkProgress;
