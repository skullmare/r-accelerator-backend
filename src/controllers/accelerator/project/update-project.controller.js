export async function updateProject(req, res) {
    try {
        Object.assign(req.project, req.validatedData.body);
        req.project.lastActivityAt = new Date();
        await req.project.save();
        return res.success(req.project, 'Проект обновлён', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при обновлении проекта');
    }
}
