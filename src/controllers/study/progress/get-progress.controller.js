import StudyProgram from '../../../models/study/program.model.js';
import StudyProgress from '../../../models/study/progress.model.js';

export async function getProgress(req, res) {
    try {
        const { programId } = req.validatedData.params;

        // загружаем программу с полной популяцией items через refPath
        const program = await StudyProgram.findById(programId)
            .populate('modules.items.item');
        if (!program) return res.error({}, 404, 'Программа не найдена');

        const progress = await StudyProgress.findOne({ user: req.user.id, program: programId });
        const completedIds = new Set((progress?.completedItems ?? []).map(id => id.toString()));

        const allItems = program.modules.flatMap(m => m.items);

        // вычисляем accessible для каждого элемента:
        // при sequential=false — все доступны
        // при sequential=true — ищем ближайший предыдущий урок и проверяем его прохождение
        const accessMap = new Map();
        for (let i = 0; i < allItems.length; i++) {
            if (!program.sequential) {
                accessMap.set(allItems[i]._id.toString(), true);
                continue;
            }
            const prevLesson = allItems.slice(0, i).reverse().find(el => el.type === 'StudyLesson');
            accessMap.set(
                allItems[i]._id.toString(),
                !prevLesson || completedIds.has(prevLesson.item._id.toString())
            );
        }

        // собираем ответ: структура программы с флагами completed и accessible на каждом элементе
        const modules = program.modules.map(module => ({
            _id: module._id,
            name: module.name,
            items: module.items.map(el => ({
                _id: el._id,
                type: el.type,
                item: el.item,
                completed: completedIds.has(el.item._id.toString()),
                accessible: accessMap.get(el._id.toString())
            }))
        }));

        return res.success(
            { _id: program._id, name: program.name, sequential: program.sequential, modules },
            'Прогресс получен',
            200
        );
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении прогресса');
    }
}
