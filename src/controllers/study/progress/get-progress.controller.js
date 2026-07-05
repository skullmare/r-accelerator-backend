import StudyProgram from '../../../models/study/program.model.js';
import StudyProgress from '../../../models/study/progress.model.js';
import StudyLesson from '../../../models/study/lesson.model.js';
import StudyAgent from '../../../models/study/agent.model.js';

export async function getProgress(req, res) {
    try {
        const { programId } = req.validatedData.params;

        const program = await StudyProgram.findById(programId);
        if (!program) return res.error({}, 404, 'Программа не найдена');

        const allItems = program.modules.flatMap(m => m.items);

        // собираем IDs по типу и делаем два запроса
        const lessonIds = allItems.filter(i => i.type === 'StudyLesson').map(i => i.item);
        const agentIds = allItems.filter(i => i.type === 'StudyAgent').map(i => i.item);

        const [lessons, agents, progress] = await Promise.all([
            StudyLesson.find({ _id: { $in: lessonIds } }, 'name'),
            StudyAgent.find({ _id: { $in: agentIds } }, 'name avatar role'),
            StudyProgress.findOne({ user: req.user.id, program: programId })
        ]);

        const lessonMap = new Map(lessons.map(l => [l._id.toString(), l]));
        const agentMap = new Map(agents.map(a => [a._id.toString(), a]));

        const completedIds = new Set((progress?.completedItems ?? []).map(id => id.toString()));

        // вычисляем accessible для каждого элемента: доступен, если предыдущий элемент пройден
        const accessMap = new Map();
        for (let i = 0; i < allItems.length; i++) {
            const prevItem = allItems[i - 1];
            accessMap.set(
                allItems[i]._id.toString(),
                !program.sequential || !prevItem || completedIds.has(prevItem.item.toString())
            );
        }

        const modules = program.modules.map(module => ({
            _id: module._id,
            name: module.name,
            items: module.items.map(el => {
                const itemId = el.item.toString();
                const populated = el.type === 'StudyLesson' ? lessonMap.get(itemId) : agentMap.get(itemId);
                return {
                    _id: el._id,
                    type: el.type,
                    item: populated ?? null,
                    completed: completedIds.has(itemId),
                    accessible: accessMap.get(el._id.toString())
                };
            })
        }));

        return res.success(
            { _id: program._id, name: program.name, cover: program.cover, sequential: program.sequential, modules },
            'Прогресс получен',
            200
        );
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении прогресса');
    }
}
