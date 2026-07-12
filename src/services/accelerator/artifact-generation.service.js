import Ajv from 'ajv';
import { chatComplete } from '../llm.service.js';

const ajv = new Ajv({ allErrors: true, strict: false });

function stripCodeFence(text) {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch ? fenceMatch[1] : trimmed;
}

function validateArtifactContent(content, artifactDefinition) {
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
        return 'Артефакт должен быть JSON-объектом';
    }

    for (const field of artifactDefinition.requiredFields) {
        const value = content[field];
        if (value === undefined || value === null || value === '') {
            return `Отсутствует обязательное поле артефакта: ${field}`;
        }
    }

    if (artifactDefinition.outputSchema && typeof artifactDefinition.outputSchema === 'object') {
        try {
            const validateFn = ajv.compile(artifactDefinition.outputSchema);
            if (!validateFn(content)) {
                return `Артефакт не соответствует outputSchema: ${ajv.errorsText(validateFn.errors)}`;
            }
        } catch {
            // Admin-authored schemas aren't guaranteed valid JSON Schema — this is a
            // best-effort admin tool, not a production-hardened schema store, so we
            // fall back to the requiredFields check above instead of failing hard.
        }
    }

    return null;
}

// Asks the agent's model for a single, final structured artifact matching
// artifactDefinition (DONE-1/DONE-4). Runs as its own LLM call, separate
// from the chat turns in messages/, so producing the artifact never
// depends on parsing free-form chat replies.
export async function generateArtifactJson({ agent, systemPrompt, conversationMessages }) {
    const instruction =
        `Сформируй финальный артефакт "${agent.artifactDefinition.artifactType}" по итогам диалога выше.\n` +
        `Ответь СТРОГО валидным JSON-объектом (без markdown, без пояснений) со следующими обязательными полями: ` +
        `${agent.artifactDefinition.requiredFields.join(', ') || '(поля не заданы)'}.` +
        (agent.artifactDefinition.summaryField ? ` Поле "${agent.artifactDefinition.summaryField}" должно содержать краткую сводку артефакта.` : '');

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
        { role: 'user', content: instruction }
    ];

    const { content: rawContent, tokenUsage } = await chatComplete({
        provider: agent.modelConfig.provider,
        model: agent.modelConfig.model,
        temperature: agent.modelConfig.temperature,
        maxTokens: agent.modelConfig.maxTokens,
        messages
    });

    let parsed;
    try {
        parsed = JSON.parse(stripCodeFence(rawContent));
    } catch {
        const error = new Error('Модель вернула невалидный JSON для артефакта');
        error.code = 'ARTIFACT_VALIDATION_FAILED';
        throw error;
    }

    const validationError = validateArtifactContent(parsed, agent.artifactDefinition);
    if (validationError) {
        const error = new Error(validationError);
        error.code = 'ARTIFACT_VALIDATION_FAILED';
        throw error;
    }

    const summary = agent.artifactDefinition.summaryField && typeof parsed[agent.artifactDefinition.summaryField] === 'string'
        ? parsed[agent.artifactDefinition.summaryField]
        : JSON.stringify(parsed).slice(0, 500);

    const title = agent.artifactDefinition.titleTemplate || `${agent.name}: ${agent.artifactDefinition.artifactType}`;

    return { content: parsed, summary, title, tokenUsage };
}
