import { abortMultipartUpload } from '../../services/s3.service.js';

export async function abortUploadController(req, res) {
    try {
        const { uploadId, key } = req.validatedData.body;

        await abortMultipartUpload({ key, uploadId });

        return res.success({}, 'Загрузка отменена', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при отмене загрузки');
    }
}
