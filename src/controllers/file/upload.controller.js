import { uploadFile } from '../../services/s3.service.js';
import File from '../../models/file.model.js';

export async function uploadFileController(req, res) {
    try {
        if (!req.file) return res.error({}, 400, 'Файл не загружен');

        const url = await uploadFile({
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname
        });

        const file = await File.create({
            name: req.file.originalname,
            url,
            type: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.user.id,
            source: 'user'
        });

        return res.success(file, 'Файл загружен', 200);
    } catch (error) {
        return res.error({description: error.message, code: error.code}, 500, 'Ошибка при загрузке файла');
    }
}
