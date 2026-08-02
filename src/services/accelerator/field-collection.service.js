// Живая заполненность артефакта — замена агенту-«оценщику»
// (бывший completion-evaluation.service.js).
//
// Раньше завершённость этапа была МНЕНИЕМ отдельной модели: после каждого хода
// вызывался аудитор, заново перечитывал всю историю и выдавал вердикт
// ready/missingFields. Отсюда две беды. Первая — вердикт приезжал к агенту с
// опозданием на ход (оценка идёт ПОСЛЕ ответа), поэтому агент прощался с
// пользователем, пока оценщик держал этап неготовым, и на одном экране
// оказывались два противоречащих сообщения. Вторая — мнение пересобиралось с
// нуля каждый раз, так что поле, признанное собранным на пятом ходу, на седьмом
// могло снова оказаться в missingFields.
//
// Здесь завершённость перестала быть суждением и стала арифметикой. Агент по
// ходу диалога складывает добытые данные в session.collectedFields через
// инструмент save_collected_fields, состояние накапливается в базе, а
// готовность этапа — это сравнение числа заполненных полей с числом
// требуемых. Спорить не с кем: второго мнения в системе больше нет.

import Message from '../../models/accelerator/message.model.js';
import { chatComplete } from '../llm.service.js';

export const SAVE_FIELDS_TOOL_NAME = 'save_collected_fields';

// Значение поля пишет агент (это может быть его формулировка, согласованная с
// пользователем), поэтому нижняя граница чисто символическая — от пустышек.
const MIN_VALUE_CHARS = 2;
// А вот цитата должна быть узнаваемым фрагментом реплики, иначе проверка
// происхождения вырождается: «да» найдётся в половине диалогов.
const MIN_QUOTE_CHARS = 4;
const MAX_VALUE_CHARS = 2000;
// Сколько символов значения показывать агенту в чек-листе. Полные значения
// длинных полей раздували бы системный промпт на каждом ходу без пользы —
// агенту нужно знать, что поле закрыто, а не перечитывать его целиком.
const CHECKLIST_VALUE_PREVIEW_CHARS = 160;

// Поле-сводка (artifactDefinition.summaryField, по умолчанию "summary") из
// чек-листа исключено намеренно: это не собираемые у пользователя данные, а
// синтез остальных полей, который делается уже при генерации артефакта. Требуй
// мы его в диалоге — агент не смог бы предъявить цитату пользователя, и этап
// не завершился бы никогда.
export function collectibleFields(agent) {
    const summaryField = agent.artifactDefinition.summaryField;
    return (agent.artifactDefinition.requiredFields || []).filter((field) => field !== summaryField);
}

// Сравнение цитаты с репликами пользователя идёт по нормализованному тексту:
// модель почти всегда переставляет регистр и пунктуацию, воспроизводя фразу, и
// побуквенное сравнение отклоняло бы честные цитаты. Буквы и цифры остаются,
// всё остальное схлопывается в пробел; ё/е приводятся к одному виду.
function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export function buildSaveFieldsTool(agent) {
    const fields = collectibleFields(agent);
    if (!fields.length) return null;

    return {
        type: 'function',
        function: {
            name: SAVE_FIELDS_TOOL_NAME,
            description:
                'Сохранить данные, которые пользователь сообщил в диалоге, в карточку этапа. ' +
                'Вызывай сразу, как только получил ответ по любому из полей — не жди конца этапа ' +
                'и не копи данные в уме. Можно передать несколько полей за раз. ' +
                'Это НЕ завершение этапа: этап закрывается автоматически, когда заполнены все поля.',
            parameters: {
                type: 'object',
                properties: {
                    fields: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            properties: {
                                name: {
                                    type: 'string',
                                    enum: fields,
                                    description: 'Имя поля карточки этапа.'
                                },
                                value: {
                                    type: 'string',
                                    description:
                                        'Итоговая формулировка данных по этому полю. Может быть твоей ' +
                                        'формулировкой, если пользователь её подтвердил.'
                                },
                                quote: {
                                    type: 'string',
                                    description:
                                        'Дословный фрагмент СООБЩЕНИЯ ПОЛЬЗОВАТЕЛЯ, на основании которого ' +
                                        'ты заполняешь поле. Копируй точно, слово в слово, из реплики ' +
                                        'пользователя — не из своей. Свои слова цитировать нельзя.'
                                }
                            },
                            required: ['name', 'value', 'quote'],
                            additionalProperties: false
                        }
                    }
                },
                required: ['fields'],
                additionalProperties: false
            }
        }
    };
}

// Все реплики пользователя сессии (не только последние HISTORY_LIMIT): поле
// может быть заполнено по данным, сказанным сорок сообщений назад, и цитата на
// них обязана проходить проверку.
export async function loadUserUtterances(sessionId) {
    const messages = await Message.find({ sessionId, senderType: 'user' }).select('content');
    return messages.map((m) => m.content);
}

// Проверка происхождения. Что она гарантирует: значение поля привязано к
// реально существующей реплике пользователя, а не появилось из воздуха на
// ходу, где пользователь ничего не отвечал. Чего она НЕ гарантирует:
// содержательности ответа — короткое «да, согласен» пройдёт. Это осознанный
// компромисс: более строгая проверка потребовала бы оценивать смысл, то есть
// вернуть в систему второе мнение, ради устранения которого всё и затевалось.
function validateUpdate(update, allowedFields, normalizedUtterances) {
    const name = typeof update?.name === 'string' ? update.name.trim() : '';
    const value = typeof update?.value === 'string' ? update.value.trim() : '';
    const quote = typeof update?.quote === 'string' ? update.quote.trim() : '';

    if (!allowedFields.includes(name)) {
        return { error: `Неизвестное поле "${name || '(пусто)'}". Допустимые: ${allowedFields.join(', ')}.` };
    }
    if (value.length < MIN_VALUE_CHARS) {
        return { error: `Поле "${name}": значение слишком короткое.` };
    }
    if (quote.length < MIN_QUOTE_CHARS) {
        return { error: `Поле "${name}": цитата слишком короткая, приведи узнаваемый фрагмент реплики пользователя.` };
    }

    const normalizedQuote = normalize(quote);
    const matched = normalizedUtterances.some((utterance) => utterance.includes(normalizedQuote));
    if (!matched) {
        return {
            error: `Поле "${name}": цитата не найдена в сообщениях пользователя. ` +
                'Скопируй фрагмент дословно из его реплики — пересказ и собственные формулировки не принимаются. ' +
                'Если пользователь этих данных не давал, не сохраняй поле, а задай вопрос.'
        };
    }

    return { entry: { name, value: value.slice(0, MAX_VALUE_CHARS), quote } };
}

// Применяет пачку обновлений к session.collectedFields. Частичный успех —
// штатный исход: валидные поля сохраняются, невалидные возвращаются агенту с
// причиной, и он в этом же ходу либо переформулирует, либо задаёт вопрос.
// Сессия здесь не сохраняется — это делает вызывающий код одним save вместе с
// остальными изменениями сессии.
export function applyFieldUpdates({ session, agent, updates, userUtterances, sourceMessageId = null }) {
    const allowedFields = collectibleFields(agent);
    const normalizedUtterances = userUtterances.map(normalize);

    const saved = [];
    const rejected = [];

    for (const update of Array.isArray(updates) ? updates : []) {
        const { entry, error } = validateUpdate(update, allowedFields, normalizedUtterances);
        if (error) {
            rejected.push({ name: update?.name ?? null, reason: error });
            continue;
        }

        session.collectedFields.set(entry.name, {
            value: entry.value,
            quote: entry.quote,
            sourceMessageId,
            updatedAt: new Date()
        });
        saved.push(entry.name);
    }

    return { saved, rejected };
}

const BACKFILL_TEMPERATURE = 0;
const BACKFILL_MAX_TOKENS = 1500;

// Разовый перенос уже состоявшегося диалога в карточку этапа. Нужен только
// сессиям, начатым до появления save_collected_fields: у них есть история на
// десятки сообщений и пустая карточка, поэтому без переноса агент честно
// увидел бы «заполнено 0 из 5» и пошёл бы спрашивать всё заново.
//
// Свежих сессий это не касается — вызывающий код запускает бэкфилл только при
// наличии ответов агента в истории, то есть когда диалог уже шёл до текущего
// хода. Извлечённые поля проходят ровно ту же проверку цитат, что и обычное
// сохранение: перенос не является поводом ослабить требования к происхождению
// данных.
export async function backfillCollectedFields({ session, agent, conversationMessages, userUtterances }) {
    const fields = collectibleFields(agent);
    if (!fields.length) return { saved: [], rejected: [] };

    const instruction =
        'Перенеси в карточку этапа данные, которые пользователь УЖЕ сообщил в диалоге выше.\n' +
        `Поля карточки: ${fields.join(', ')}.\n` +
        'Ответь JSON-объектом вида {"fields":[{"name":"…","value":"…","quote":"…"}]}, где quote — ' +
        'дословный фрагмент сообщения ПОЛЬЗОВАТЕЛЯ (не твоего), подтверждающий эти данные.\n' +
        'Включай только те поля, по которым пользователь действительно ответил. Ничего не додумывай: ' +
        'если данных нет — не включай поле в массив. Пустой массив — нормальный ответ.';

    const { content } = await chatComplete({
        // Бэкфилл — разовая механическая выжимка, ей не нужна основная модель.
        // Здесь у modelConfig.evaluatorModel остаётся единственное применение
        // после удаления оценщика готовности.
        model: agent.modelConfig.evaluatorModel || agent.modelConfig.model,
        temperature: BACKFILL_TEMPERATURE,
        maxTokens: BACKFILL_MAX_TOKENS,
        messages: [
            { role: 'system', content: agent.systemPrompt },
            ...conversationMessages,
            { role: 'user', content: instruction }
        ],
        json: true
    });

    const parsed = JSON.parse(content);
    return applyFieldUpdates({ session, agent, updates: parsed?.fields, userUtterances });
}

export function getFilledFields(session, agent) {
    return collectibleFields(agent).filter((field) => Boolean(session.collectedFields?.get(field)));
}

export function getMissingFields(session, agent) {
    return collectibleFields(agent).filter((field) => !session.collectedFields?.get(field));
}

// Готовность этапа как арифметика, а не как вердикт. Форма объекта сохранена
// от оценщика (ready/missingFields/reason/evaluatedAt/evaluatedAfterMessageId)
// — на неё завязан фронт: кнопка показывается по completionState.ready, а
// STAGE_NOT_READY отдаёт missingFields и reason.
export function syncCompletionState(session, agent, { lastMessageId = null } = {}) {
    const fields = collectibleFields(agent);
    const missingFields = getMissingFields(session, agent);
    const ready = missingFields.length === 0;

    // Агент без обязательных полей — незаполненная настройка, а не «этап без
    // требований». Гейту в этом случае не на чем держаться: пустой список полей
    // сходится с пустой карточкой на первом же ходу. Держать этап вечно
    // незавершаемым нельзя (пользователь окажется в тупике), поэтому ready
    // остаётся true, но причина говорит прямо, что проверки нет, — иначе
    // «Собраны все данные этапа (0 из 0)» читалось бы как успех.
    const reason = !fields.length
        ? 'Гейт готовности отключён: у агента не заданы обязательные поля артефакта ' +
          '(artifactDefinition.requiredFields пуст). Этап можно завершить в любой момент — ' +
          'серверу нечего проверять.'
        : ready
            ? `Собраны все данные этапа (${fields.length} из ${fields.length}).`
            : `Собрано ${fields.length - missingFields.length} из ${fields.length}. Не хватает: ${missingFields.join(', ')}.`;

    session.completionState = {
        ready,
        missingFields,
        reason,
        evaluatedAt: new Date(),
        evaluatedAfterMessageId: lastMessageId
    };

    return session.completionState;
}

function truncate(text) {
    const value = String(text ?? '');
    return value.length > CHECKLIST_VALUE_PREVIEW_CHARS
        ? `${value.slice(0, CHECKLIST_VALUE_PREVIEW_CHARS)}…`
        : value;
}

// Блок системного промпта вместо прежнего buildStageStatusPrompt. Ключевое
// отличие: рендерится из базы, а не из чужого вердикта, поэтому он всегда
// актуален на текущий ход и не может противоречить тому, что агент видит в
// диалоге. Заодно он прямо показывает агенту, что спрашивать дальше — раньше
// это приходилось домысливать из completionCriteria прозой.
export function buildFieldChecklistPrompt(session, agent) {
    const fields = collectibleFields(agent);

    // Полей нет — значит и чек-листа нет. Раньше здесь агенту прямо
    // разрешалось «завершать по своему усмотрению», и он честно это делал:
    // подытоживал и звал нажимать кнопку сразу после первой же реплики
    // пользователя. Незаполненная настройка агента не должна превращаться в
    // указание свернуть этап, поэтому инструкция обратная — работать по
    // completionCriteria и не объявлять завершение самому.
    if (!fields.length) {
        return 'Карточка этапа не настроена: администратор не задал обязательные поля артефакта. ' +
            'Ориентируйся на критерии завершения этапа выше и продолжай собирать по ним информацию.\n' +
            'Не объявляй этап завершённым, не подводи итоги по собственной инициативе и не предлагай ' +
            'перейти к следующему этапу — момент завершения выбирает пользователь.';
    }

    const lines = fields.map((field) => {
        const entry = session.collectedFields?.get(field);
        return entry ? `  [x] ${field}: ${truncate(entry.value)}` : `  [ ] ${field} — не собрано`;
    });

    const filled = fields.length - getMissingFields(session, agent).length;
    const header = `Карточка этапа — заполнено ${filled} из ${fields.length}:\n${lines.join('\n')}`;

    const rules =
        '\n\nКак с этим работать:\n' +
        `- Как только пользователь сообщил данные по любому незаполненному пункту, вызывай инструмент ` +
        `${SAVE_FIELDS_TOOL_NAME} — сразу, в том же ходу, не откладывая на потом.\n` +
        '- Задавай вопросы по одному, идя по незаполненным пунктам сверху вниз.\n' +
        '- Этот список — единственный источник истины о заполненности. Не утверждай, что данные собраны, ' +
        'если пункт помечен как не собранный.';

    if (filled === fields.length) {
        return `${header}\n\nВсе данные этапа собраны. Кратко подытожь результат и предложи пользователю нажать ` +
            'кнопку «Завершить этап», чтобы сформировать итоговый документ. Сам этап ты не завершаешь ' +
            'и на следующий этап не переводишь — это делает пользователь.';
    }

    return `${header}${rules}\n\nЭтап ещё не завершён: не прощайся, не желай удачи на следующем этапе ` +
        'и не сообщай, что можно переходить дальше.';
}
