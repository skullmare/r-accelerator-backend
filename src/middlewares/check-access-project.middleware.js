import Project from '../models/accelerator/project.model.js';

async function checkAccessProject(req, res, next) {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
        return res.error({}, 404, 'Проект не найден');
    }

    if (!project.ownerId.equals(req.user.id)) {
        return res.error({}, 403, 'Нет доступа к проекту');
    }

    req.project = project;
    next();
}

export default checkAccessProject;
