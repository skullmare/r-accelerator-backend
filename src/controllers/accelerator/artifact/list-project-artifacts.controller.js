import Artifact from '../../../models/accelerator/artifact.model.js';

export async function listProjectArtifacts(req, res) {
    try {
        const { projectId } = req.validatedData.params;

        const items = await Artifact.find({ projectId }).sort({ createdAt: 1 });

        return res.success({ items }, 'Артефакты проекта получены', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении артефактов проекта');
    }
}
