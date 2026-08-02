import { LLM } from '../../../config/accelerator.config.js';
import { chatComplete } from '../llm.service.js';
import { renderCollectedData } from './data-collection.service.js';
import { renderDocumentToPdf } from './pdf-renderer.service.js';
import { uploadFile } from '../s3.service.js';

// Сколько символов сводки уходит в контекст следующего агента.
const MAX_SUMMARY_CHARS = 2000;

function generationError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

// Документ этапа. Один вызов модели, обычный текст на выходе — никакого JSON
// и никаких схем: раньше артефакт сначала собирался как JSON по
// requiredFields (и падал с ARTIFACT_VALIDATION_FAILED, если модель не
// заполнила поле), а потом переписывался в документ вторым вызовом. Теперь
// опорой служат данные, которые агент сам собрал в диалоге.
async function generateDocumentMarkdown({ agent, systemPrompt, retrievedContextMessage, conversationMessages, collectedData }) {
    const collected = renderCollectedData(collectedData);

    const instruction =
        'Напиши итоговый документ этапа по результатам диалога выше. Это готовый деловой документ ' +
        'для основателя стартапа, а не пересказ разговора: связный текст по существу, без обращений ' +
        'к пользователю и без фраз вроде «как мы обсудили».\n\n' +
        (collected
            ? `Собранные в диалоге данные — опирайся прежде всего на них:\n${collected}\n\n`
            : '') +
        'Строго соблюдай ограничения формата (текст будет автоматически свёрстан в PDF):\n' +
        '- Только Markdown следующего вида: заголовки #, ##, ###; абзацы; списки «- » и «1. »; ' +
        'таблицы вида | ячейка | ячейка |; горизонтальный разделитель ---; выделение **жирным** и *курсивом*.\n' +
        '- НЕ используй: блоки кода, картинки, ссылки, HTML, цитаты.\n' +
        '- Не дублируй название документа заголовком первого уровня — титул добавляется автоматически.\n\n' +
        'Опирайся только на собранную в диалоге информацию. Если по какому-то пункту данных ' +
        'недостаточно — честно отметь это в тексте, а не выдумывай.';

    const { content } = await chatComplete({
        model: LLM.model,
        temperature: LLM.temperature,
        maxTokens: LLM.documentMaxTokens,
        messages: [
            { role: 'system', content: systemPrompt },
            ...(retrievedContextMessage ? [retrievedContextMessage] : []),
            ...conversationMessages,
            { role: 'user', content: instruction }
        ]
    });

    const markdown = String(content ?? '').trim();
    if (!markdown) {
        throw generationError('Модель вернула пустой документ этапа', 'ARTIFACT_EMPTY');
    }

    return markdown;
}

// Сводка для следующего агента строится из собранных данных, а не отдельным
// вызовом модели: это уже выжимка этапа, она детерминирована и не может
// провалиться. Fallback на начало документа — для этапов, где агент ничего не
// сохранил (например, пользователь завершил этап досрочно).
function buildSummary(collectedData, markdown) {
    const collected = renderCollectedData(collectedData);
    const text = collected || markdown.replace(/[#*|>-]/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, MAX_SUMMARY_CHARS);
}

function safeFileName(title) {
    const base = String(title)
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return `${base || 'artifact'}.pdf`;
}

// Полный цикл: текст документа -> PDF -> S3. В MongoDB ничего не пишет —
// это делает completeSession.
export async function generateArtifact({ agent, project, systemPrompt, retrievedContextMessage, conversationMessages, collectedData }) {
    const markdown = await generateDocumentMarkdown({
        agent, systemPrompt, retrievedContextMessage, conversationMessages, collectedData
    });

    const title = `${agent.name}: итоги этапа`;

    const pdfBuffer = await renderDocumentToPdf({
        markdown,
        title,
        subtitle: agent.description,
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
        throw generationError(`Не удалось загрузить PDF документа в хранилище: ${error.message}`, 'ARTIFACT_UPLOAD_FAILED');
    }

    return {
        title,
        documentMarkdown: markdown,
        summary: buildSummary(collectedData, markdown),
        file: {
            key: uploaded.key,
            url: uploaded.url,
            mimeType: 'application/pdf',
            size: pdfBuffer.length
        }
    };
}
