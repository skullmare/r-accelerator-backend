import Knowledge from '../../../models/accelerator/knowledge.model.js';
import File from '../../../models/file.model.js';
import { processKnowledge } from '../../../services/knowledge-processing/process-knowledge.job.js';
import logger from '../../../../config/logger.config.js';

export async function createKnowledge(req, res) {
    try {
        const { title, description = null, fileId = null, sourceUrl = null } = req.validatedData.body;

        if (fileId) {
            const exists = await File.exists({ _id: fileId });
            if (!exists) {
                return res.error({ code: 'FILE_NOT_FOUND', description: `File "${fileId}" не найден` }, 400, 'fileId должен ссылаться на существующий файл');
            }
        }

        const knowledge = await Knowledge.create({
            title,
            description,
            fileId,
            sourceUrl,
            createdBy: req.user.id,
            status: 'pending'
        });

        // Векторизация синхронная (очереди нет). Сбой обработки не роняет
        // создание записи — статус фиксируется в самом документе Knowledge.
        try {
            await processKnowledge({ knowledgeId: String(knowledge._id) });
        } catch (error) {
            logger.error(`Ошибка обработки knowledge ${knowledge._id}: ${error.message}`);
        }

        const processed = await Knowledge.findById(knowledge._id);
        return res.success(processed, 'База знаний создана', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании базы знаний');
    }
}
