import Knowledge from '../../../models/accelerator/knowledge.model.js';

export async function listKnowledge(req, res) {
    try {
        const items = await Knowledge.find().sort({ createdAt: -1 });
        return res.success(items, 'Список баз знаний получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении списка баз знаний');
    }
}
