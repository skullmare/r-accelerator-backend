import { completeMultipartUpload } from '../../services/s3.service.js';
import File from '../../models/file.model.js';
import { findOwnedProject } from '../../services/accelerator/project-ownership.service.js';
import { processFile } from '../../services/file-processing/process-file.job.js';
import logger from '../../../config/logger.config.js';

export async function completeUploadController(req, res) {
    try {
        const { uploadId, key, parts, originalname, mimetype, size, projectId } = req.validatedData.body;

        if (projectId) {
            const { status } = await findOwnedProject(projectId, req.user.id);
            if (status === 404) return res.error({}, 404, 'Проект не найден');
            if (status === 403) return res.error({}, 403, 'Нет доступа к проекту');
        }

        const url = await completeMultipartUpload({ key, uploadId, parts });

        const file = await File.create({
            name: originalname,
            url,
            key,
            type: mimetype,
            size,
            uploadedBy: req.user.id,
            source: 'user',
            projectId: projectId || null,
        });

        // Синхронная обработка (очереди больше нет). Сбой индексации не роняет
        // загрузку — статус фиксируется в самом документе File.
        if (projectId) {
            try {
                await processFile({ fileId: String(file._id) });
            } catch (error) {
                logger.error(`Ошибка обработки файла ${file._id}: ${error.message}`);
            }
            const processed = await File.findById(file._id);
            return res.success(processed, 'Файл успешно загружен', 200);
        }

        return res.success(file, 'Файл успешно загружен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении загрузки');
    }
}
