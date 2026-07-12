import File from '../../../models/file.model.js';
import { enqueue } from '../../../services/queue/job-queue.service.js';
import { FILE_PROCESS_JOB_TYPE } from '../../../services/file-processing/process-file.job.js';

export async function reindexFile(req, res) {
    try {
        const { projectId, fileId } = req.validatedData.params;

        const file = await File.findOne({ _id: fileId, projectId });
        if (!file) {
            return res.error({ code: 'FILE_NOT_FOUND' }, 404, 'Файл не найден в этом проекте');
        }

        file.processingStatus = 'indexing';
        file.qdrantStatus = 'not_indexed';
        file.processingError = null;
        await file.save();

        await enqueue(FILE_PROCESS_JOB_TYPE, { fileId: String(file._id) });

        return res.success({ processingStatus: file.processingStatus }, 'Индексация запущена', 202);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при запуске индексации файла');
    }
}
