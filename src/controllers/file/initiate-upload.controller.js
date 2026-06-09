import { createMultipartUpload, generateKey } from '../../services/s3.service.js';

export async function initiateUploadController(req, res) {
    try {
        const { filename, mimetype, size } = req.validatedData.body;

        const key = generateKey(filename);
        const uploadId = await createMultipartUpload({ key, mimetype });

        return res.success({ uploadId, key }, 'Multipart upload инициирован', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при инициализации загрузки');
    }
}
