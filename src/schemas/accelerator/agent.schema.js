import z from 'zod';

const artifactDefinitionSchema = z.object({
    artifactType: z.string().trim().min(1).max(100),
    titleTemplate: z.string().trim().max(200).nullable().optional(),
    requiredFields: z.array(z.string().trim().min(1)).default([]),
    outputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
    summaryField: z.string().trim().min(1).max(100).default('summary')
}).strict();

const contextPolicySchema = z.object({
    includeProjectSummary: z.boolean().default(true),
    includePreviousArtifacts: z.boolean().default(true),
    qdrantTopK: z.number().int().min(1).max(20).default(6),
    maxContextChars: z.number().int().min(500).max(40000).default(6000),
    allowedSourceTypes: z.array(z.enum(['project_summary', 'agent_summary', 'artifact', 'file_chunk', 'user_note'])).default(['project_summary', 'artifact', 'file_chunk'])
}).strict();

const modelConfigSchema = z.object({
    provider: z.enum(['openai', 'openrouter']).default('openai'),
    model: z.string().trim().min(1).max(100).default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.4),
    maxTokens: z.number().int().min(100).max(8000).default(1500)
}).strict();

// POST /accelerator/admin/agents — создание агента (agents:manage)
const createAgentSchema = z.object({
    body: z.object({
        code: z.string().trim().min(1).max(50),
        name: z.string().trim().min(1).max(150),
        roleTitle: z.string().trim().min(1).max(150),
        order: z.number().int(),
        isActive: z.boolean().default(true),
        systemPrompt: z.string().trim().min(1).max(20000),
        completionCriteria: z.string().trim().min(1).max(5000),
        artifactDefinition: artifactDefinitionSchema,
        nextAgentCode: z.string().trim().min(1).max(50).nullable().optional(),
        contextPolicy: contextPolicySchema.default({}),
        modelConfig: modelConfigSchema.default({})
    }).strict()
});

// PATCH /accelerator/admin/agents/:agentId — обновление агента (agents:manage)
const updateAgentSchema = z.object({
    params: z.object({ agentId: z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID') }),
    body: z.object({
        code: z.string().trim().min(1).max(50).optional(),
        name: z.string().trim().min(1).max(150).optional(),
        roleTitle: z.string().trim().min(1).max(150).optional(),
        order: z.number().int().optional(),
        isActive: z.boolean().optional(),
        systemPrompt: z.string().trim().min(1).max(20000).optional(),
        completionCriteria: z.string().trim().min(1).max(5000).optional(),
        artifactDefinition: artifactDefinitionSchema.optional(),
        nextAgentCode: z.string().trim().min(1).max(50).nullable().optional(),
        contextPolicy: contextPolicySchema.optional(),
        modelConfig: modelConfigSchema.optional()
    }).strict()
});

const agentIdSchema = z.object({
    params: z.object({ agentId: z.string().regex(/^[0-9a-f]{24}$/, 'Некорректный ID') })
});

export default { createAgentSchema, updateAgentSchema, agentIdSchema };
