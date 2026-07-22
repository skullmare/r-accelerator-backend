import File from '../../../models/file.model.js';

export async function getFileProcessingStatus(req, res) {
    try {
        const { projectId, fileId } = req.validatedData.params;

        const file = await File.findOne({ _id: fileId, projectId });
        if (!file) {
            return res.error({ code: 'FILE_NOT_FOUND' }, 404, 'Файл не найден в этом проекте');
        }

        return res.success({
            processingStatus: file.processingStatus,
            extractedTextStatus: file.extractedTextStatus,
            qdrantStatus: file.qdrantStatus,
            qdrantPointsCount: file.qdrantPointIds.length,
            processingError: file.processingError,
            processingErrorCode: file.processingErrorCode,
            indexedAt: file.indexedAt
        }, 'Статус обработки файла получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении статуса обработки файла');
    }
}
