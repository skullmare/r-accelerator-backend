import StudyProgram from '../models/study/program.model.js';
import StudyProgress from '../models/study/progress.model.js';

async function checkItemUnlocked(req, res, next) {
    const { lessonId, agentId } = req.params;
    const itemId = lessonId ?? agentId;
    const programId = req.program?._id;

    const program = await StudyProgram.findById(programId, 'sequential modules.items');

    if (!program) {
        return res.error({}, 404, 'Программа обучения не найдена');
    }

    if (!program.sequential) {
        return next();
    }

    const allItems = program.modules.flatMap(m => m.items);
    const currentIndex = allItems.findIndex(i => i.item.equals(itemId));
    const prevItem = allItems[currentIndex - 1];

    if (!prevItem) {
        return next();
    }

    const progress = await StudyProgress.findOne(
        { user: req.user.id, program: programId },
        'completedItems'
    );

    const isPrevItemCompleted = progress?.completedItems?.some(id => id.equals(prevItem.item));

    if (!isPrevItemCompleted) {
        return res.error({}, 403, 'Предыдущий элемент не пройден');
    }

    next();
}

export default checkItemUnlocked;
