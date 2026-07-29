import { chatComplete } from '../llm.service.js';

// Серверная оценка готовности этапа (ТЗ спринта 3, DONE-4: «Сервер проверяет
// completionCriteria…»). До этого completionCriteria уходили в промпт агента
// как текст и ни на что не влияли: этап завершался ровно тогда, когда фронт
// вызывал /complete, а единственной проверкой была структурная валидация уже
// сгенерированного JSON. Это позволяло «завершить» этап после первой реплики —
// модель просто выдумывала недостающие поля, и валидация их пропускала.
//
// Здесь оценка вынесена в ОТДЕЛЬНЫЙ вызов модели, работающий не как эксперт, а
// как аудитор диалога: он не помогает пользователю и ничего не досочиняет, а
// только сверяет собранное с критериями завершения и списком обязательных
// полей артефакта.

const EVALUATOR_TEMPERATURE = 0;
// Ответ оценщика — маленький JSON; ограничение защищает от разрастания
// reason/missingFields, если модель решит написать эссе.
const EVALUATOR_MAX_TOKENS = 800;
const MAX_REASON_CHARS = 1000;

export class CompletionEvaluationError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

function buildEvaluatorSystemPrompt(agent) {
    // Администратор может задать свой промпт оценщика (Agent.completionEvaluatorPrompt).
    // Если он не задан — собираем дефолтный из тех же данных агента.
    const base = agent.completionEvaluatorPrompt?.trim() ||
        'Ты — строгий аудитор полноты диалога. Твоя задача не помогать пользователю, ' +
        'а проверить, действительно ли в диалоге собрана информация, необходимая для ' +
        'завершения этапа. Ты не придумываешь и не додумываешь данные: если чего-то ' +
        'нет в диалоге явно — этого нет.';

    const requiredFields = agent.artifactDefinition.requiredFields;

    return [
        base,
        `Критерии завершения этапа:\n${agent.completionCriteria}`,
        `Обязательные поля итогового артефакта: ${requiredFields.join(', ') || '(не заданы)'}.`,
        'Правила оценки:\n' +
        '- Поле считается собранным, только если пользователь сообщил соответствующую информацию ' +
        'в диалоге (или она явно есть в справочном контексте). Ответы агента сами по себе не являются ' +
        'подтверждением: если агент задал вопрос, а пользователь не ответил — поле НЕ собрано.\n' +
        '- Общие фразы («рынок большой», «конкуренты есть») не считаются собранными данными.\n' +
        '- Лучше ошибиться в сторону "не готово", чем пропустить незаполненный этап.'
    ].join('\n\n---\n\n');
}

function buildInstruction(requiredFields) {
    return 'Оцени, готов ли этап к формированию итогового артефакта. ' +
        'Ответь JSON-объектом строго такой формы:\n' +
        '{\n' +
        '  "ready": boolean,            // true только если собрано ВСЁ необходимое\n' +
        '  "missingFields": string[],   // имена обязательных полей, данные для которых ещё не собраны\n' +
        `  "reason": string             // одно-два предложения по-русски: чего не хватает или почему готово\n` +
        '}\n' +
        `Допустимые значения missingFields: ${requiredFields.join(', ') || '(поля не заданы)'}. ` +
        'Если ready=true, missingFields должен быть пустым массивом.';
}

function normalizeResult(parsed, requiredFields) {
    const known = new Set(requiredFields);
    const missingFields = Array.isArray(parsed.missingFields)
        ? [...new Set(parsed.missingFields.filter((f) => typeof f === 'string' && known.has(f)))]
        : [];

    // Внутренняя согласованность важнее самоотчёта модели: если она перечислила
    // недостающие поля, но поставила ready=true — верим списку, а не флагу.
    const ready = Boolean(parsed.ready) && missingFields.length === 0;

    const reason = typeof parsed.reason === 'string'
        ? parsed.reason.slice(0, MAX_REASON_CHARS)
        : (ready ? 'Все необходимые данные собраны.' : 'Собраны не все необходимые данные.');

    return { ready, missingFields, reason };
}

// conversationMessages: [{ role: 'user'|'assistant', content }] — та же история,
// что уходит агенту (см. getSessionHistory в expert-session.service.js).
export async function evaluateCompletion({ agent, conversationMessages }) {
    const requiredFields = agent.artifactDefinition.requiredFields || [];

    // Пока пользователь не сказал ничего, оценивать нечего — этап заведомо не
    // готов. Экономим вызов модели на самом частом раннем состоянии диалога.
    const hasUserInput = conversationMessages.some((m) => m.role === 'user');
    if (!hasUserInput) {
        return {
            ready: false,
            missingFields: [...requiredFields],
            reason: 'Диалог с агентом ещё не начат — данные не собраны.'
        };
    }

    const messages = [
        { role: 'system', content: buildEvaluatorSystemPrompt(agent) },
        ...conversationMessages,
        { role: 'user', content: buildInstruction(requiredFields) }
    ];

    let rawContent;
    try {
        ({ content: rawContent } = await chatComplete({
            // Оценщик вызывается на каждый ход диалога, поэтому админ может
            // посадить его на модель дешевле основной (modelConfig.evaluatorModel).
            model: agent.modelConfig.evaluatorModel || agent.modelConfig.model,
            temperature: EVALUATOR_TEMPERATURE,
            maxTokens: EVALUATOR_MAX_TOKENS,
            messages,
            json: true
        }));
    } catch (error) {
        throw new CompletionEvaluationError(
            `Не удалось оценить готовность этапа: ${error.message}`,
            'COMPLETION_EVALUATION_FAILED'
        );
    }

    let parsed;
    try {
        parsed = JSON.parse(rawContent);
    } catch {
        throw new CompletionEvaluationError(
            'Оценщик готовности вернул невалидный JSON',
            'COMPLETION_EVALUATION_FAILED'
        );
    }

    return normalizeResult(parsed, requiredFields);
}
