import File from '../../models/file.model.js';

export async function listFiles(req, res) {
    try {
        const { page, limit, source, projectId } = req.validatedData.query;
        const skip = (page - 1) * limit;

        const filter = { uploadedBy: req.user.id };
        if (source) filter.source = source;
        if (projectId) filter.projectId = projectId;

        const [files, total] = await Promise.all([
            File.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            File.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(total / limit);

        return res.success(
            { files, pagination: { page, limit, total, totalPages, hasMore: page < totalPages } },
            'Список файлов получен',
            200
        );
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении файлов');
    }
}
