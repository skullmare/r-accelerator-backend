import Project from '../../../models/accelerator/project.model.js';

export async function listProjects(req, res) {
    try {
        const projects = await Project.find({ ownerId: req.user.id }).sort({ lastActivityAt: -1 });
        return res.success(projects, 'Список проектов получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении проектов');
    }
}
