import { uploadFile } from '../../services/s3.service.js';

export async function uploadFileController(req, res) {
    if (!req.file) return res.error({}, 400, 'Файл не загружен');

    const url = await uploadFile({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname
    });

    return res.success({ url }, 'Файл загружен', 200);
}
