import { completeMultipartUpload } from '../../services/s3.service.js';
import File from '../../models/file.model.js';
import { findOwnedProject } from '../../services/accelerator/project-ownership.service.js';
import { enqueue } from '../../services/queue/job-queue.service.js';
import { FILE_PROCESS_JOB_TYPE } from '../../services/file-processing/process-file.job.js';

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

        if (projectId) {
            await enqueue(FILE_PROCESS_JOB_TYPE, { fileId: String(file._id) });
        }

        return res.success(file, 'Файл успешно загружен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении загрузки');
    }
}
