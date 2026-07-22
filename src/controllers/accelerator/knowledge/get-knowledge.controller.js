import Knowledge from '../../../models/accelerator/knowledge.model.js';

export async function getKnowledge(req, res) {
    try {
        const { knowledgeId } = req.validatedData.params;

        const knowledge = await Knowledge.findById(knowledgeId);
        if (!knowledge) {
            return res.error({ code: 'KNOWLEDGE_NOT_FOUND' }, 404, 'База знаний не найдена');
        }

        return res.success(knowledge, 'База знаний получена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении базы знаний');
    }
}
