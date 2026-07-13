import { uploadFile } from '../../services/s3.service.js';
import File from '../../models/file.model.js';
import { findOwnedProject } from '../../services/accelerator/project-ownership.service.js';
import { enqueue } from '../../services/queue/job-queue.service.js';
import { FILE_PROCESS_JOB_TYPE } from '../../services/file-processing/process-file.job.js';

export async function uploadFileController(req, res) {
    try {
        if (!req.file) return res.error({}, 400, 'Файл не загружен');

        const projectId = req.body.projectId || null;
        if (projectId) {
            const { status } = await findOwnedProject(projectId, req.user.id);
            if (status === 404) return res.error({}, 404, 'Проект не найден');
            if (status === 403) return res.error({}, 403, 'Нет доступа к проекту');
        }

        const { url, key } = await uploadFile({
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname
        });

        const file = await File.create({
            name: req.file.originalname,
            url,
            key,
            type: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.user.id,
            source: 'user',
            projectId
        });

        if (projectId) {
            await enqueue(FILE_PROCESS_JOB_TYPE, { fileId: String(file._id) });
        }

        return res.success(file, 'Файл загружен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при загрузке файла');
    }
}
