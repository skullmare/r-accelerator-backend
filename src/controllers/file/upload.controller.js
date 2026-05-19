import multer from 'multer';
import { uploadFile } from '../../services/s3.service.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

export const uploadMiddleware = upload.single('file');

export async function uploadFileController(req, res) {
    if (!req.file) return res.error({}, 400, 'Файл не загружен');

    const url = await uploadFile({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname
    });

    return res.success({ url }, 'Файл загружен', 200);
}
