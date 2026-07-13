import File from '../../../models/file.model.js';

export async function listProjectFiles(req, res) {
    try {
        const { projectId } = req.validatedData.params;

        const files = await File.find({ projectId }).sort({ createdAt: -1 });

        return res.success(files, 'Файлы проекта получены', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении файлов проекта');
    }
}
