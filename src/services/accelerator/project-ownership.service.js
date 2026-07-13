import Project from '../../models/accelerator/project.model.js';

// Small helper shared by endpoints that receive projectId in the request
// body rather than as a route param (so the check-access-project
// middleware, which reads req.params.projectId, doesn't apply directly).
export async function findOwnedProject(projectId, userId) {
    if (!projectId) return { project: null, status: null };

    const project = await Project.findById(projectId);
    if (!project) return { project: null, status: 404 };
    if (!project.ownerId.equals(userId)) return { project: null, status: 403 };

    return { project, status: 200 };
}
