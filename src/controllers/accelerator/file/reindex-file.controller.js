import File from '../../../models/file.model.js';
import { processFile } from '../../../services/file-processing/process-file.job.js';

export async function reindexFile(req, res) {
    try {
        const { projectId, fileId } = req.validatedData.params;

        const file = await File.findOne({ _id: fileId, projectId });
        if (!file) {
            return res.error({ code: 'FILE_NOT_FOUND' }, 404, 'Файл не найден в этом проекте');
        }

        // Синхронная переиндексация (очереди больше нет): processFile сам
        // чистит старые точки в Qdrant (deleteBySource) и записывает новые.
        // При сбое проставляет processingStatus='failed' и пробрасывает ошибку.
        await processFile({ fileId: String(file._id) });

        const processed = await File.findById(file._id);
        return res.success({
            processingStatus: processed.processingStatus,
            qdrantStatus: processed.qdrantStatus,
            processingErrorCode: processed.processingErrorCode
        }, 'Файл переиндексирован', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при переиндексации файла');
    }
}
