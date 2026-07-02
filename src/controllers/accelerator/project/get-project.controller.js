export async function getProject(req, res) {
    try {
        return res.success(req.project, 'Проект получен', 200);
    } catch (error) {
        return res.error({ description: error.message, code: error.code }, 500, 'Ошибка при получении проекта');
    }
}
