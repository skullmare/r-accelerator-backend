import Project from '../../../models/accelerator/project.model.js';

export async function createProject(req, res) {
    try {
        const { name, description, userRole, industry, businessSpecifics, stage, goal, status } = req.validatedData.body;
        const project = await Project.create({
            ownerId: req.user.id,
            name,
            description,
            userRole,
            industry,
            businessSpecifics,
            stage,
            goal,
            status
        });
        return res.success(project, 'Проект создан', 201);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при создании проекта');
    }
}
