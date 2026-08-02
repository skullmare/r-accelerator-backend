// Сбор данных этапа: два инструмента, которыми агент пользуется по ходу
// диалога, и блок системного промпта, который показывает ему текущее
// состояние.
//
// Прежняя версия требовала от агента заполнять фиксированный список полей
// артефакта, подтверждая каждое дословной цитатой пользователя, а готовность
// этапа считала арифметикой «заполнено N из M». Это давало ровно тот эффект,
// от которого уходим: агент упирался в поле, которое пользователь не мог
// сформулировать, цитата не проходила проверку, и этап не завершался никогда.
//
// Теперь схемы нет. Агент сам решает, какие данные важны для его этапа (это
// описано в его systemPrompt), складывает их в свободное хранилище
// ExpertSession.collectedData и сам же объявляет этап собранным, когда
// выполнено условие из Agent.completionPrompt.

export const SAVE_DATA_TOOL = 'save_data';
export const STAGE_READY_TOOL = 'stage_ready';

const MAX_KEY_CHARS = 100;
const MAX_VALUE_CHARS = 2000;
// Сколько символов значения показывать агенту в карточке. Полные значения
// раздували бы системный промпт на каждом ходу без пользы.
const PREVIEW_CHARS = 200;

export function buildTools() {
    return [
        {
            type: 'function',
            function: {
                name: SAVE_DATA_TOOL,
                description:
                    'Сохранить данные, которые пользователь сообщил в диалоге. Вызывай сразу, как только ' +
                    'узнал что-то существенное для этапа, — не жди конца разговора. Можно передать несколько ' +
                    'записей за раз. Повторный вызов с тем же ключом обновляет запись.',
                parameters: {
                    type: 'object',
                    properties: {
                        items: {
                            type: 'array',
                            minItems: 1,
                            items: {
                                type: 'object',
                                properties: {
                                    key: {
                                        type: 'string',
                                        description:
                                            'Короткое имя данных латиницей в camelCase, например "targetAudience". ' +
                                            'Ключи придумываешь сам, исходя из своей роли и условия завершения этапа.'
                                    },
                                    value: {
                                        type: 'string',
                                        description: 'Сами данные — формулировка по итогам разговора с пользователем.'
                                    }
                                },
                                required: ['key', 'value'],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ['items'],
                    additionalProperties: false
                }
            }
        },
        {
            type: 'function',
            function: {
                name: STAGE_READY_TOOL,
                description:
                    'Отметить, что условие завершения этапа выполнено и данных достаточно для итогового ' +
                    'документа. Вызывай один раз, когда всё собрано. Это не завершает этап: после вызова ' +
                    'пользователь увидит кнопку «сформировать документ» и нажмёт её сам.',
                parameters: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false
                }
            }
        }
    ];
}

function saveItems(session, items) {
    const saved = [];

    for (const item of Array.isArray(items) ? items : []) {
        const key = typeof item?.key === 'string' ? item.key.trim().slice(0, MAX_KEY_CHARS) : '';
        const value = typeof item?.value === 'string' ? item.value.trim().slice(0, MAX_VALUE_CHARS) : '';
        if (!key || !value) continue;

        session.collectedData.set(key, value);
        saved.push(key);
    }

    return saved;
}

// Исполнение вызовов инструментов. Результат уходит обратно В МОДЕЛЬ (не
// пользователю) внутри того же хода — агент сразу видит, что записано, и
// продолжает разговор с актуальной картиной.
//
// Сессию здесь не сохраняем: вызывающий код пишет её одним save вместе с
// остальными изменениями хода.
export function applyToolCalls({ session, toolCalls }) {
    const toolMessages = [];
    let changed = false;

    for (const call of toolCalls) {
        const name = call.function?.name;
        let result;

        if (name === SAVE_DATA_TOOL) {
            let args = null;
            try {
                args = JSON.parse(call.function.arguments || '{}');
            } catch {
                args = null;
            }

            const saved = args ? saveItems(session, args.items) : [];
            if (saved.length) changed = true;

            result = saved.length
                ? { ok: true, saved }
                : { ok: false, error: 'Ничего не сохранено: передай непустые key и value.' };
        } else if (name === STAGE_READY_TOOL) {
            if (!session.readyForArtifact) changed = true;
            session.readyForArtifact = true;
            result = { ok: true, message: 'Этап отмечен как собранный. Предложи пользователю сформировать документ.' };
        } else {
            result = { ok: false, error: `Неизвестный инструмент: ${name}` };
        }

        toolMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result)
        });
    }

    return { toolMessages, changed };
}

function preview(value) {
    const text = String(value ?? '');
    return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
}

// Собранные данные в виде «ключ: значение» — используется и в промпте агента,
// и при генерации документа, и как сводка артефакта.
export function renderCollectedData(collectedData, { truncate = false } = {}) {
    const entries = collectedData ? [...collectedData.entries()] : [];
    if (!entries.length) return '';

    return entries
        .map(([key, value]) => `- ${key}: ${truncate ? preview(value) : value}`)
        .join('\n');
}

// Блок системного промпта: условие завершения + что уже собрано + что делать
// дальше. Рендерится из базы на каждом ходу, поэтому агент всегда видит
// актуальное состояние и не может утверждать, что собрал то, чего в хранилище
// нет.
export function buildStagePrompt(agent, session) {
    const collected = renderCollectedData(session.collectedData, { truncate: true });

    const parts = [
        `Условие завершения этапа:\n${agent.completionPrompt}`,
        collected
            ? `Уже собранные данные этапа:\n${collected}`
            : 'Уже собранные данные этапа: пока ничего не собрано.'
    ];

    if (session.readyForArtifact) {
        parts.push(
            'Условие завершения уже выполнено. Кратко подытожь результат и предложи пользователю нажать ' +
            'кнопку «Сформировать документ». Сам этап ты не завершаешь и на следующий этап не переводишь — ' +
            'это делает пользователь. Если он захочет что-то дополнить, продолжай разговор и сохраняй ' +
            `новые данные через ${SAVE_DATA_TOOL}.`
        );
    } else {
        parts.push(
            'Как работать:\n' +
            `- Как только пользователь сообщил что-то существенное, вызывай ${SAVE_DATA_TOOL} — сразу, в том же ходу.\n` +
            '- Задавай вопросы по одному, не вываливай список.\n' +
            `- Как только условие завершения выполнено, вызови ${STAGE_READY_TOOL} и предложи пользователю ` +
            'сформировать документ этапа.\n' +
            '- Пока условие не выполнено — не прощайся и не говори, что можно переходить дальше.'
        );
    }

    return parts.join('\n\n');
}
