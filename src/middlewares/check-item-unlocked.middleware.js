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

    // ищем ближайший предыдущий урок (агенты пропускаем)
    const prevLesson = allItems
        .slice(0, currentIndex)
        .reverse()
        .find(i => i.type === 'StudyLesson');

    if (!prevLesson) {
        return next();
    }

    const progress = await StudyProgress.findOne(
        { user: req.user.id, program: programId },
        'completedItems'
    );

    const isPrevLessonCompleted = progress?.completedItems?.some(id => id.equals(prevLesson.item));

    if (!isPrevLessonCompleted) {
        return res.error({}, 403, 'Предыдущий урок не пройден');
    }

    next();
}

export default checkItemUnlocked;
