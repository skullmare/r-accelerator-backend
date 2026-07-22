import Knowledge from '../../../models/accelerator/knowledge.model.js';

// Обновление только метаданных (title/description). Источник и векторы не
// трогаются — для переиндексации есть отдельный reindex-эндпоинт.
export async function updateKnowledge(req, res) {
    try {
        const { knowledgeId } = req.validatedData.params;
        const data = req.validatedData.body;

        const knowledge = await Knowledge.findByIdAndUpdate(
            knowledgeId,
            { $set: data },
            { new: true, runValidators: true }
        );
        if (!knowledge) {
            return res.error({ code: 'KNOWLEDGE_NOT_FOUND' }, 404, 'База знаний не найдена');
        }

        return res.success(knowledge, 'База знаний обновлена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении базы знаний');
    }
}
