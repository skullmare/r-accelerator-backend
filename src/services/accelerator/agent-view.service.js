// Публичное представление агента — то, что можно отдавать обычному
// пользователю. Промпты (systemPrompt, completionPrompt) и список знаний
// наружу не уходят: они видны только в админском CRUD, за правом
// accelerator_agents.manage.
export function toPublicAgent(agent) {
    if (!agent) return null;

    return {
        _id: agent._id,
        name: agent.name,
        description: agent.description,
        avatarUrl: agent.avatarUrl,
        thinkingAvatarUrl: agent.thinkingAvatarUrl,
        order: agent.order
    };
}
