import Ajv from 'ajv';
import { chatComplete } from '../llm.service.js';
import { renderDocumentToPdf } from './pdf-renderer.service.js';
import { uploadFile } from '../s3.service.js';

const ajv = new Ajv({ allErrors: true, strict: false });

// Документ артефакта — основной результат этапа для пользователя, он длиннее
// набора полей, поэтому у него свой лимит токенов, не связанный с
// modelConfig.maxTokens (тот рассчитан на реплику в чате).
const DOCUMENT_MIN_MAX_TOKENS = 4000;

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

function validationError(message) {
    const error = new Error(message);
    error.code = 'ARTIFACT_VALIDATION_FAILED';
    return error;
}

// Шаг 1 — структурированные поля. Они не показываются пользователю напрямую,
// но именно на них держится вся передача контекста дальше по маршруту:
// summary уходит в Project.contextSummary следующему агенту, а content
// индексируется в Qdrant. Поэтому structured-слой остаётся даже теперь, когда
// пользовательский результат этапа — PDF.
async function generateStructuredContent({ agent, systemPrompt, retrievedContextMessage, conversationMessages }) {
    const instruction =
        `Сформируй структурированные данные артефакта "${agent.artifactDefinition.artifactType}" по итогам диалога выше.\n` +
        `Ответь JSON-объектом со следующими обязательными полями: ` +
        `${agent.artifactDefinition.requiredFields.join(', ') || '(поля не заданы)'}.` +
        (agent.artifactDefinition.summaryField ? ` Поле "${agent.artifactDefinition.summaryField}" должно содержать краткую сводку артефакта.` : '') +
        '\nОпирайся только на информацию из диалога и справочного контекста — не выдумывай данные.';

    const messages = [
        { role: 'system', content: systemPrompt },
        ...(retrievedContextMessage ? [retrievedContextMessage] : []),
        ...conversationMessages,
        { role: 'user', content: instruction }
    ];

    const { content: rawContent, tokenUsage } = await chatComplete({
        model: agent.modelConfig.model,
        temperature: agent.modelConfig.temperature,
        maxTokens: agent.modelConfig.maxTokens,
        messages,
        // Раньше "верни строго JSON" было только просьбой в тексте промпта, и
        // модель регулярно оборачивала ответ в markdown или пояснения — это
        // давало ложный ARTIFACT_VALIDATION_FAILED. Теперь формат обеспечен
        // самим провайдером.
        json: true
    });

    let parsed;
    try {
        parsed = JSON.parse(stripCodeFence(rawContent));
    } catch {
        throw validationError('Модель вернула невалидный JSON для артефакта');
    }

    const message = validateArtifactContent(parsed, agent.artifactDefinition);
    if (message) throw validationError(message);

    return { parsed, tokenUsage };
}

// Шаг 2 — сам документ. Отдельным вызовом, а не полем внутри JSON: длинный
// текст, упакованный в JSON-строку, часто обрывается на лимите токенов и
// ломает разбор всего ответа. Здесь модель пишет обычный текст, поэтому
// испортить нечего.
async function generateDocumentMarkdown({ agent, systemPrompt, retrievedContextMessage, conversationMessages, structuredContent }) {
    const instruction =
        `Напиши финальный документ этапа — "${agent.artifactDefinition.artifactType}". ` +
        'Это готовый деловой документ для основателя стартапа, а не пересказ диалога: ' +
        'связный текст, по существу, без обращений к пользователю и без фраз вроде «как мы обсудили».\n\n' +
        'Строго соблюдай ограничения формата (текст будет автоматически свёрстан в PDF):\n' +
        '- Только Markdown следующего вида: заголовки #, ##, ###; абзацы; списки «- » и «1. »; ' +
        'таблицы вида | ячейка | ячейка |; горизонтальный разделитель ---; выделение **жирным** и *курсивом*.\n' +
        '- НЕ используй: блоки кода, картинки, ссылки, HTML, цитаты.\n' +
        '- Не дублируй название документа заголовком первого уровня — титул добавляется автоматически.\n\n' +
        'Документ должен раскрывать те же данные, что и структурированный результат этапа:\n' +
        `${JSON.stringify(structuredContent, null, 2)}\n\n` +
        'Опирайся только на собранную в диалоге информацию. Если по какому-то пункту данных недостаточно — ' +
        'честно отметь это в тексте, а не выдумывай.';

    const messages = [
        { role: 'system', content: systemPrompt },
        ...(retrievedContextMessage ? [retrievedContextMessage] : []),
        ...conversationMessages,
        { role: 'user', content: instruction }
    ];

    const { content, tokenUsage } = await chatComplete({
        model: agent.modelConfig.model,
        temperature: agent.modelConfig.temperature,
        maxTokens: Math.max(agent.modelConfig.maxTokens, DOCUMENT_MIN_MAX_TOKENS),
        messages
    });

    const markdown = String(content ?? '').trim();
    if (!markdown) {
        throw validationError('Модель вернула пустой документ артефакта');
    }

    return { markdown, tokenUsage };
}

function safeFileName(title) {
    const base = String(title)
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return `${base || 'artifact'}.pdf`;
}

// Полный цикл создания артефакта: структура -> документ -> PDF -> S3.
// Возвращает всё, что нужно для записи Artifact; сам документ в MongoDB не
// пишет — это делает completeSession.
export async function generateArtifact({ agent, project, systemPrompt, retrievedContextMessage, conversationMessages }) {
    const { parsed, tokenUsage: structuredUsage } = await generateStructuredContent({
        agent, systemPrompt, retrievedContextMessage, conversationMessages
    });

    const summary = agent.artifactDefinition.summaryField && typeof parsed[agent.artifactDefinition.summaryField] === 'string'
        ? parsed[agent.artifactDefinition.summaryField]
        : JSON.stringify(parsed).slice(0, 500);

    const title = agent.artifactDefinition.titleTemplate || `${agent.name}: ${agent.artifactDefinition.artifactType}`;

    const { markdown, tokenUsage: documentUsage } = await generateDocumentMarkdown({
        agent, systemPrompt, retrievedContextMessage, conversationMessages, structuredContent: parsed
    });

    const pdfBuffer = await renderDocumentToPdf({
        markdown,
        title,
        subtitle: agent.roleTitle,
        meta: {
            projectName: project.name,
            agentName: agent.name,
            generatedAt: new Date().toLocaleDateString('ru-RU')
        }
    });

    let uploaded;
    try {
        uploaded = await uploadFile({
            buffer: pdfBuffer,
            mimetype: 'application/pdf',
            originalname: safeFileName(title)
        });
    } catch (error) {
        const uploadError = new Error(`Не удалось загрузить PDF артефакта в хранилище: ${error.message}`);
        uploadError.code = 'ARTIFACT_UPLOAD_FAILED';
        throw uploadError;
    }

    return {
        content: parsed,
        summary,
        title,
        documentMarkdown: markdown,
        file: {
            key: uploaded.key,
            url: uploaded.url,
            mimeType: 'application/pdf',
            size: pdfBuffer.length,
            generatedAt: new Date()
        },
        tokenUsage: { structured: structuredUsage ?? null, document: documentUsage ?? null }
    };
}
