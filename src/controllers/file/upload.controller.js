import { uploadFile } from '../../services/s3.service.js';
import File from '../../models/file.model.js';
import { findOwnedProject } from '../../services/accelerator/project-ownership.service.js';
import { processFile } from '../../services/file-processing/process-file.job.js';
import logger from '../../../config/logger.config.js';

export async function uploadFileController(req, res) {
    try {
        if (!req.file) return res.error({}, 400, 'Файл не загружен');

        const projectId = req.body.projectId || null;
        if (projectId) {
            const { status } = await findOwnedProject(projectId, req.user.id);
            if (status === 404) return res.error({}, 404, 'Проект не найден');
            if (status === 403) return res.error({}, 403, 'Нет доступа к проекту');
        }

        // multer (busboy) декодирует имя файла из multipart как latin1, из-за
        // чего UTF-8 кириллица приходит «крякозябрами» (Ð Ð Ð½Ð°...). Возвращаем
        // исходное имя, перекодировав байты latin1 -> utf8. Для ASCII-имён это
        // no-op, поэтому безопасно.
        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const { url, key } = await uploadFile({
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: originalName
        });

        const file = await File.create({
            name: originalName,
            url,
            key,
            type: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.user.id,
            source: 'user',
            projectId
        });

        // Обработка/индексация теперь синхронная (очереди больше нет). Сбой
        // индексации не должен ронять сам upload — файл уже загружен в S3 и
        // сохранён; processFile сам проставит file.processingStatus='failed'.
        // Возвращаем свежую версию документа с актуальным статусом обработки.
        if (projectId) {
            try {
                await processFile({ fileId: String(file._id) });
            } catch (error) {
                logger.error(`Ошибка обработки файла ${file._id}: ${error.message}`);
            }
            const processed = await File.findById(file._id);
            return res.success(processed, 'Файл загружен', 200);
        }

        return res.success(file, 'Файл загружен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при загрузке файла');
    }
}
