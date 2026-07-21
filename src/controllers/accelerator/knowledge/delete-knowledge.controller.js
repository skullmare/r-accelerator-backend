import Knowledge from '../../../models/accelerator/knowledge.model.js';
import Agent from '../../../models/accelerator/agent.model.js';
import { deleteByKnowledge } from '../../../services/qdrant.service.js';

export async function deleteKnowledge(req, res) {
    try {
        const { knowledgeId } = req.validatedData.params;

        const knowledge = await Knowledge.findById(knowledgeId);
        if (!knowledge) {
            return res.error({ code: 'KNOWLEDGE_NOT_FOUND' }, 404, 'База знаний не найдена');
        }

        // Сначала чистим векторы, затем документ и висячие ссылки у агентов.
        await deleteByKnowledge(String(knowledge._id));
        await Agent.updateMany(
            { knowledgeIds: knowledge._id },
            { $pull: { knowledgeIds: knowledge._id } }
        );
        await knowledge.deleteOne();

        return res.success({ id: String(knowledge._id) }, 'База знаний удалена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при удалении базы знаний');
    }
}
