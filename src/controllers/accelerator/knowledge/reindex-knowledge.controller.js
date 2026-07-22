import Knowledge from '../../../models/accelerator/knowledge.model.js';
import File from '../../../models/file.model.js';
import { processKnowledge } from '../../../services/knowledge-processing/process-knowledge.job.js';

// Повторная синхронная векторизация. Можно переопределить источник, передав
// новый fileId ИЛИ sourceUrl — тогда он сохраняется в документе перед
// обработкой (обработка всегда идёт от источника, записанного в Knowledge).
export async function reindexKnowledge(req, res) {
    try {
        const { knowledgeId } = req.validatedData.params;
        const { fileId, sourceUrl } = req.validatedData.body;

        const knowledge = await Knowledge.findById(knowledgeId);
        if (!knowledge) {
            return res.error({ code: 'KNOWLEDGE_NOT_FOUND' }, 404, 'База знаний не найдена');
        }

        if (fileId && sourceUrl) {
            return res.error({ code: 'INVALID_SOURCE' }, 400, 'Укажите только один источник: fileId или sourceUrl');
        }

        if (fileId) {
            const exists = await File.exists({ _id: fileId });
            if (!exists) {
                return res.error({ code: 'FILE_NOT_FOUND', description: `File "${fileId}" не найден` }, 400, 'fileId должен ссылаться на существующий файл');
            }
            knowledge.fileId = fileId;
            knowledge.sourceUrl = null;
            await knowledge.save();
        } else if (sourceUrl) {
            knowledge.sourceUrl = sourceUrl;
            knowledge.fileId = null;
            await knowledge.save();
        }

        await processKnowledge({ knowledgeId: String(knowledge._id) });

        const processed = await Knowledge.findById(knowledge._id);
        return res.success({
            status: processed.status,
            chunksCount: processed.chunksCount,
            processingErrorCode: processed.processingErrorCode
        }, 'База знаний переиндексирована', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при переиндексации базы знаний');
    }
}
