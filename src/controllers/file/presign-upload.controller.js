import { getPresignedPartUrls } from '../../services/s3.service.js';

export async function presignUploadController(req, res) {
    try {
        const { uploadId, key, partNumbers } = req.validatedData.body;

        const urls = await getPresignedPartUrls({ key, uploadId, partNumbers });

        return res.success({ urls }, 'Presigned URLs получены', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении presigned URLs');
    }
}
