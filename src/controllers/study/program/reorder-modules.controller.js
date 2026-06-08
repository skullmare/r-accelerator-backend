import StudyProgram from '../../../models/study/program.model.js';

export async function reorderModules(req, res) {
    try {
        const { programId } = req.validatedData.params;
        const { moduleIds } = req.validatedData.body;

        const program = await StudyProgram.findById(programId);
        if (!program) return res.error({}, 404, 'Программа не найдена');

        // проверяем что все переданные ID принадлежат этой программе
        const existingIds = new Set(program.modules.map(m => m._id.toString()));
        const allValid = moduleIds.every(id => existingIds.has(id));
        if (!allValid) return res.error({}, 400, 'Один или несколько moduleId не принадлежат этой программе');

        // строим новый порядок модулей по переданному списку ID
        const moduleMap = new Map(program.modules.map(m => [m._id.toString(), m]));
        program.modules = moduleIds.map(id => moduleMap.get(id));
        await program.save();

        return res.success(program.modules, 'Порядок модулей обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при изменении порядка модулей');
    }
}
