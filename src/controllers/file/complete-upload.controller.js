import { completeMultipartUpload } from '../../services/s3.service.js';
import File from '../../models/file.model.js';

export async function completeUploadController(req, res) {
    try {
        const { uploadId, key, parts, originalname, mimetype, size } = req.validatedData.body;

        const url = await completeMultipartUpload({ key, uploadId, parts });

        const file = await File.create({
            name: originalname,
            url,
            type: mimetype,
            size,
            uploadedBy: req.user.id,
            source: 'user',
        });

        return res.success(file, 'Файл успешно загружен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при завершении загрузки');
    }
}
