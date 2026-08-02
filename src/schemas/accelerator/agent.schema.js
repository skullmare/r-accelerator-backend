import z from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID');

const url = z.string().trim().url('Должен быть корректный URL').max(2000);

// Набор полей агента намеренно минимален: два промпта, знания, четыре
// отображаемых поля и два системных. Технические настройки LLM и контекста
// вынесены в config/accelerator.config.js и через API не задаются.
const agentFields = {
    systemPrompt: z.string().trim().min(1).max(20000),
    completionPrompt: z.string().trim().min(1).max(5000),
    knowledgeIds: z.array(objectId).default([]),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(1000).nullable().optional(),
    avatarUrl: url.nullable().optional(),
    thinkingAvatarUrl: url.nullable().optional(),
    order: z.number().int(),
    nextAgentId: objectId.nullable().optional()
};

// POST /accelerator/admin/agents — создание агента (accelerator_agents.manage)
const createAgentSchema = z.object({
    body: z.object(agentFields).strict()
});

// PATCH /accelerator/admin/agents/:agentId — обновление агента
const updateAgentSchema = z.object({
    params: z.object({ agentId: objectId }),
    body: z.object({
        systemPrompt: agentFields.systemPrompt.optional(),
        completionPrompt: agentFields.completionPrompt.optional(),
        knowledgeIds: z.array(objectId).optional(),
        name: agentFields.name.optional(),
        description: agentFields.description,
        avatarUrl: agentFields.avatarUrl,
        thinkingAvatarUrl: agentFields.thinkingAvatarUrl,
        order: agentFields.order.optional(),
        nextAgentId: agentFields.nextAgentId
    }).strict()
});

const agentIdSchema = z.object({
    params: z.object({ agentId: objectId })
});

export default { createAgentSchema, updateAgentSchema, agentIdSchema };
