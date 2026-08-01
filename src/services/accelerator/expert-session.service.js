import Agent from '../../models/accelerator/agent.model.js';
import ExpertSession from '../../models/accelerator/expert-session.model.js';
import Message from '../../models/accelerator/message.model.js';
import Artifact from '../../models/accelerator/artifact.model.js';
import { assembleContext } from './context-assembly.service.js';
import { chatCompleteStream } from '../llm.service.js';
import { generateArtifact } from './artifact-generation.service.js';
import {
    SAVE_FIELDS_TOOL_NAME,
    applyFieldUpdates,
    backfillCollectedFields,
    buildFieldChecklistPrompt,
    buildSaveFieldsTool,
    collectibleFields,
    getMissingFields,
    loadUserUtterances,
    syncCompletionState
} from './field-collection.service.js';
import { upsertChunks } from '../qdrant.service.js';
import { chunkText } from '../file-processing/chunker.js';

const MAX_CONTEXT_SUMMARY_CHARS = 4000;
const HISTORY_LIMIT = 30;
// Сколько раз за один ход агенту позволено вызвать инструмент. После
// исчерпания финальный проход идёт с tool_choice: 'none' — модель физически не
// может вызвать тул снова и обязана ответить текстом. Это жёсткий потолок
// стоимости хода (максимум два вызова LLM) и защита от зацикливания
// «вызвал -> получил отказ -> вызвал снова».
const MAX_TOOL_ROUNDS = 1;
// Ответ на случай, если после принудительного текстового прохода модель всё
// равно не выдала ни символа: Message.content обязателен, и падать здесь,
// потеряв уже сохранённое сообщение пользователя, было бы хуже заглушки.
const EMPTY_REPLY_FALLBACK = 'Записал. Продолжим — что скажете?';

export class ExpertSessionError extends Error {
    constructor(message, status, code, details = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// Self-healing fallback for EXP-2: an old/new project with no
// currentAgentId falls back to the first active agent by `order`,
// and that resolution is persisted so it only happens once.
//
// Самолечение применяется ТОЛЬКО к свежим проектам (ни одного пройденного
// этапа). У проекта, который уже двигался по маршруту, currentAgentId=null —
// это осмысленное состояние «маршрут завершён» (DONE-5), а не пробел в данных:
// без этой проверки первый же GET expert-route после финального агента
// подставлял первого агента обратно и молча перезапускал пройденный маршрут.
// Сюда же попадает случай «текущий агент удалён администратором посреди
// маршрута» — прыгать на первого агента (уже пройденного) было бы ещё хуже,
// чем честно вернуть null и дать админке починить конфигурацию.
export async function resolveCurrentAgent(project) {
    let agent = project.currentAgentId
        ? await Agent.findById(project.currentAgentId)
        : null;

    const isFreshProject = project.completedAgentIds.length === 0 && project.status !== 'completed';
    if (!agent && isFreshProject) {
        agent = await Agent.findOne({ isActive: true }).sort({ order: 1 });
        if (agent) {
            project.currentAgentId = agent._id;
            await project.save();
        }
    }

    return agent;
}

export async function loadSessionAndAgent(project, sessionId) {
    const session = await ExpertSession.findOne({ _id: sessionId, projectId: project._id });
    if (!session) {
        throw new ExpertSessionError('Экспертная сессия не найдена', 404, 'SESSION_NOT_FOUND');
    }

    const agent = await Agent.findById(session.agentId);
    if (!agent) {
        throw new ExpertSessionError('Агент сессии не найден', 404, 'AGENT_NOT_FOUND');
    }

    return { session, agent };
}

export async function createSession(project, agentId) {
    const agent = await Agent.findById(agentId);
    if (!agent) {
        throw new ExpertSessionError('Агент не найден', 404, 'AGENT_NOT_FOUND');
    }
    if (!agent.isActive) {
        throw new ExpertSessionError('Агент временно отключён администратором', 409, 'AGENT_INACTIVE');
    }

    const currentAgent = await resolveCurrentAgent(project);
    if (!currentAgent || !currentAgent._id.equals(agent._id)) {
        throw new ExpertSessionError('Этот агент сейчас недоступен в маршруте проекта', 409, 'AGENT_NOT_CURRENT');
    }

    let session = await ExpertSession.findOne({
        projectId: project._id,
        agentId: agent._id,
        status: { $in: ['draft', 'active', 'waiting_user_confirmation'] }
    }).sort({ createdAt: -1 });

    if (!session) {
        session = await ExpertSession.create({ projectId: project._id, agentId: agent._id, status: 'active' });
    }

    return { session, agent };
}

// Последние HISTORY_LIMIT сообщений в хронологическом порядке. Сортировка идёт
// по убыванию именно для того, чтобы limit отсекал СТАРЫЕ сообщения, а не
// новые: при сортировке по возрастанию (как было раньше) в длинном диалоге
// модель получала первые 30 реплик и не видела ничего из недавних — из-за чего
// поздно собранные данные не попадали ни в ответ агента, ни в артефакт.
async function getSessionHistory(sessionId) {
    const messages = await Message.find({ sessionId }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);
    return messages
        .reverse()
        .map((m) => ({ role: m.senderType === 'assistant' ? 'assistant' : 'user', content: m.content }));
}

// Разовый перенос старого диалога в карточку этапа. Запускается только если в
// сессии уже есть ответы агента — то есть диалог шёл до перехода на
// save_collected_fields. У новой сессии первый ход ассистентских сообщений ещё
// не имеет, и лишнего вызова модели не будет.
//
// Сбой бэкфилла не должен ломать чат: дата попытки проставляется в любом
// случае, иначе каждая следующая реплика в проблемной сессии тянула бы за
// собой новый неудачный вызов модели.
async function maybeBackfillCollectedFields(session, agent, history) {
    if (session.fieldsBackfilledAt) return;
    if (session.collectedFields?.size) return;
    if (!collectibleFields(agent).length) return;
    if (!history.some((m) => m.role === 'assistant')) return;

    session.fieldsBackfilledAt = new Date();
    try {
        const userUtterances = await loadUserUtterances(session._id);
        await backfillCollectedFields({ session, agent, conversationMessages: history, userUtterances });
    } catch {
        // Молча: агент просто переспросит то, что не удалось перенести.
    }
    await session.save();
}

// Исполнение вызовов инструмента. Отказ здесь — это не ошибка хода, а обычный
// результат, который уходит обратно В МОДЕЛЬ (а не пользователю) внутри того
// же хода: агент видит причину, и вместо прощания задаёт недостающий вопрос.
// Ровно за этим тул и вводился — прежний оценщик сообщал о своём несогласии
// только следующим ходом, когда пользователь уже прочитал «этап завершён».
async function executeToolCalls({ session, agent, toolCalls, sourceMessageId }) {
    const userUtterances = await loadUserUtterances(session._id);
    const toolMessages = [];
    let savedAny = false;

    for (const call of toolCalls) {
        let result;

        if (call.function?.name !== SAVE_FIELDS_TOOL_NAME) {
            result = { ok: false, error: `Неизвестный инструмент: ${call.function?.name}` };
        } else {
            let args = null;
            try {
                args = JSON.parse(call.function.arguments || '{}');
            } catch {
                args = null;
            }

            if (!args) {
                result = { ok: false, error: 'Аргументы инструмента — невалидный JSON. Повтори вызов корректно.' };
            } else {
                const { saved, rejected } = applyFieldUpdates({
                    session,
                    agent,
                    updates: args.fields,
                    userUtterances,
                    sourceMessageId
                });
                if (saved.length) savedAny = true;

                result = {
                    ok: rejected.length === 0,
                    saved,
                    rejected,
                    missingFields: getMissingFields(session, agent)
                };
            }
        }

        toolMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result)
        });
    }

    return { toolMessages, savedAny };
}

// Delivers the agent's reply over SSE: onUserMessage fires as soon as the
// user's own message is persisted (so the UI can render it optimistically,
// before the LLM call even starts), onDelta fires per text fragment as the
// model streams its answer. The full assistant message is only persisted
// once the stream ends, so a dropped connection mid-stream can't leave a
// half-written message in the database.
export async function sendMessage(project, session, agent, content, { onUserMessage, onDelta, onFieldsUpdated } = {}) {
    if (session.status === 'completed') {
        throw new ExpertSessionError('Сессия уже завершена', 409, 'SESSION_ALREADY_COMPLETED');
    }

    const userMessage = await Message.create({
        sessionId: session._id,
        projectId: project._id,
        senderType: 'user',
        content
    });
    onUserMessage?.(userMessage);

    const { systemPrompt, retrievedContextMessage, contextSnapshot } = await assembleContext({ project, agent, userMessageText: content });
    const history = await getSessionHistory(session._id);

    await maybeBackfillCollectedFields(session, agent, history);

    // Чек-лист рендерится из базы прямо здесь, поэтому агент видит
    // заполненность на ТЕКУЩИЙ ход, а не вердикт, снятый после прошлого ответа.
    let messages = [{ role: 'system', content: `${systemPrompt}\n\n---\n\n${buildFieldChecklistPrompt(session, agent)}` }];
    if (retrievedContextMessage) messages.push(retrievedContextMessage);
    messages.push(...history);

    const saveFieldsTool = buildSaveFieldsTool(agent);
    const tools = saveFieldsTool ? [saveFieldsTool] : undefined;

    let replyText = '';
    let tokenUsage = null;
    let fieldsChanged = false;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const toolsAllowed = Boolean(tools) && round < MAX_TOOL_ROUNDS;

        let roundText, roundUsage, toolCalls;
        try {
            ({ content: roundText, tokenUsage: roundUsage, toolCalls } = await chatCompleteStream({
                model: agent.modelConfig.model,
                temperature: agent.modelConfig.temperature,
                maxTokens: agent.modelConfig.maxTokens,
                messages,
                tools,
                toolChoice: toolsAllowed ? 'auto' : 'none',
                onDelta
            }));
        } catch (error) {
            // Whatever code the OpenAI SDK attaches (or none) gets normalized to
            // a stable, documented code — the SSE `error` event must not leak an
            // unpredictable provider-specific value to the frontend.
            error.code = error.code || 'LLM_PROVIDER_FAILED';
            throw error;
        }

        // Текст доклеивается, а не заменяется: модель может выдать реплику и в
        // том же проходе вызвать инструмент — тогда пользователь уже получил
        // начало ответа через onDelta, и продолжение просто дописывается.
        replyText += roundText;
        if (roundUsage) tokenUsage = roundUsage;

        if (!toolCalls?.length) break;

        const { toolMessages, savedAny } = await executeToolCalls({
            session,
            agent,
            toolCalls,
            sourceMessageId: userMessage._id
        });
        if (savedAny) fieldsChanged = true;

        messages = [
            ...messages,
            { role: 'assistant', content: roundText || null, tool_calls: toolCalls },
            ...toolMessages
        ];
    }

    const assistantMessage = await Message.create({
        sessionId: session._id,
        projectId: project._id,
        senderType: 'assistant',
        content: replyText.trim() || EMPTY_REPLY_FALLBACK,
        tokenUsage
    });

    session.inputContextSnapshot = contextSnapshot;
    session.status = 'active';

    // Готовность — арифметика по карточке этапа, без вызова модели. Поэтому
    // здесь нет ни отдельного try/catch, ни события evaluation_error: падать
    // тут нечему, а состояние не может разойтись с тем, что агент только что
    // видел в промпте.
    const completionState = syncCompletionState(session, agent, { lastMessageId: assistantMessage._id });
    await session.save();

    if (fieldsChanged) {
        onFieldsUpdated?.({ collectedFields: session.collectedFields, completionState });
    }

    return { userMessage, assistantMessage, completionState, collectedFields: session.collectedFields };
}

// Гейт завершения этапа. Пропускает дальше, только если заполнены все поля
// карточки — либо если администратор явно разрешил агенту завершаться с
// частичным результатом (allowPartialCompletion).
//
// Состояние пересчитывается прямо здесь, но это уже не оценка, а подсчёт
// заполненных полей: ни вызова модели, ни разбора «не устарел ли снимок», ни
// собственного класса ошибок. Считать заново дёшево, поэтому гейт всегда
// работает по актуальным данным.
async function assertStageReady(session, agent) {
    const lastMessage = await Message.findOne({ sessionId: session._id }).sort({ createdAt: -1 }).select('_id');
    const state = syncCompletionState(session, agent, { lastMessageId: lastMessage?._id });
    await session.save();

    if (agent.allowPartialCompletion) return;

    if (!state.ready) {
        throw new ExpertSessionError(
            'Этап ещё не готов к формированию артефакта: собраны не все необходимые данные',
            409,
            'STAGE_NOT_READY',
            { missingFields: state.missingFields, reason: state.reason }
        );
    }
}

function appendContextSummary(project, agentName, artifactSummary) {
    const entry = `[${agentName}] ${artifactSummary}`;
    const combined = project.contextSummary ? `${project.contextSummary}\n\n${entry}` : entry;
    project.contextSummary = combined.length > MAX_CONTEXT_SUMMARY_CHARS
        ? combined.slice(combined.length - MAX_CONTEXT_SUMMARY_CHARS)
        : combined;
    project.contextVersion += 1;
}

// DONE-2..DONE-6: two-phase confirmation. The first call (confirmArtifact
// falsy) produces a 'ready' draft and puts the session in
// waiting_user_confirmation without switching the project's agent. Only a
// confirmArtifact:true call flips the artifact to 'confirmed', advances
// Project.currentAgentId via Agent.nextAgentId, folds the artifact
// summary into Project.contextSummary, and indexes it into Qdrant.
export async function completeSession(project, session, agent, { confirmArtifact = false, regenerate = false } = {}) {
    if (session.status === 'completed') {
        throw new ExpertSessionError('Сессия уже завершена', 409, 'SESSION_ALREADY_COMPLETED');
    }

    let artifact = session.artifactId ? await Artifact.findById(session.artifactId) : null;

    // Перегенерация черновика: прежний артефакт помечается rejected и
    // отвязывается от сессии, дальше по коду создаётся новый. Подтверждённый
    // артефакт пересоздать нельзя — он уже ушёл в контекст следующего агента
    // и в Qdrant.
    if (regenerate && artifact) {
        if (artifact.status === 'confirmed') {
            throw new ExpertSessionError('Подтверждённый артефакт нельзя сгенерировать заново', 409, 'ARTIFACT_ALREADY_CONFIRMED');
        }
        artifact.status = 'rejected';
        await artifact.save();

        session.artifactId = null;
        await session.save();
        artifact = null;
    }

    if (!artifact) {
        const history = await getSessionHistory(session._id);

        // Гейт готовности (ТЗ спринта 3, DONE-4). Стоит ДО генерации: смысл в
        // том, чтобы не дать сформировать артефакт раньше времени, а заодно не
        // тратить вызовы модели на заведомо неполный этап.
        await assertStageReady(session, agent);

        const { systemPrompt, retrievedContextMessage } = await assembleContext({ project, agent, userMessageText: agent.completionCriteria });

        let generated;
        try {
            // Карточка этапа уходит в генерацию как опора: это уже выверенные
            // данные с привязкой к репликам пользователя, поэтому модели не
            // нужно вычитывать их из истории заново — а значит, и меньше
            // поводов что-то домыслить.
            generated = await generateArtifact({
                agent,
                project,
                systemPrompt,
                retrievedContextMessage,
                conversationMessages: history,
                collectedFields: session.collectedFields
            });
        } catch (error) {
            // Only a real structural/JSON validation failure (tagged by
            // artifact-generation.service.js) is actually ARTIFACT_VALIDATION_FAILED.
            // Anything else here (network error, rate limit, auth failure —
            // the LLM call itself throwing) is a provider failure and must not
            // be mislabeled as "your artifact is invalid". Rendering and upload
            // failures carry their own codes and are equally distinct.
            if (error.code === 'ARTIFACT_VALIDATION_FAILED') {
                throw new ExpertSessionError(error.message, 422, error.code);
            }
            throw new ExpertSessionError(error.message, 502, error.code || 'LLM_PROVIDER_FAILED');
        }

        artifact = await Artifact.create({
            projectId: project._id,
            expertSessionId: session._id,
            agentId: agent._id,
            type: agent.artifactDefinition.artifactType,
            title: generated.title,
            content: generated.content,
            documentMarkdown: generated.documentMarkdown,
            file: generated.file,
            summary: generated.summary,
            status: 'draft'
        });

        // Persisted immediately, before the confirmArtifact:true branch below
        // can fail on the Qdrant write. Without this, a failed upsertChunks
        // left session.artifactId set only in memory — a retry would find no
        // linked artifact, regenerate a brand new one via a fresh LLM call,
        // and orphan the first (already-created, already-confirmed) one.
        session.artifactId = artifact._id;
        await session.save();
    }

    if (!confirmArtifact) {
        artifact.status = 'ready';
        await artifact.save();

        session.status = 'waiting_user_confirmation';
        session.outputSummary = artifact.summary;
        await session.save();

        return { artifact, nextAgentId: null, projectContextVersion: project.contextVersion, confirmed: false };
    }

    // Проверка ДО любых мутаций подтверждения: если nextAgentId указывает на
    // удалённого агента, подтверждать нельзя — иначе проект получит «висячий»
    // currentAgentId и пользователь упрётся в тупик без объяснений. Артефакт
    // при этом не теряется (остаётся ready, сессия — waiting_user_confirmation):
    // администратор чинит маршрут, пользователь подтверждает повторно.
    // Неактивный (isActive=false) агент существованием считается — это
    // временное отключение по замыслу, а не разрыв маршрута.
    if (agent.nextAgentId) {
        const nextAgentExists = await Agent.exists({ _id: agent.nextAgentId });
        if (!nextAgentExists) {
            throw new ExpertSessionError(
                'Следующий агент маршрута не найден — маршрут повреждён, обратитесь к администратору',
                409,
                'NEXT_AGENT_UNAVAILABLE'
            );
        }
    }

    artifact.status = 'confirmed';
    await artifact.save();

    try {
        // В индекс уходит documentMarkdown — связная проза документа, по
        // которой векторный поиск для следующих агентов работает заметно
        // лучше, чем по JSON.stringify со всеми его кавычками и скобками.
        // JSON-контент остаётся fallback'ом для артефактов без документа
        // (созданных до перехода на PDF).
        await upsertChunks({
            projectId: project._id,
            agentId: String(agent._id),
            sourceType: 'artifact',
            sourceId: String(artifact._id),
            chunks: chunkText(artifact.documentMarkdown || JSON.stringify(artifact.content))
        });
    } catch (error) {
        throw new ExpertSessionError('Не удалось проиндексировать артефакт в Qdrant', 502, 'QDRANT_INDEX_FAILED');
    }

    appendContextSummary(project, agent.name, artifact.summary);
    if (!project.completedAgentIds.some((id) => id.equals(agent._id))) {
        project.completedAgentIds.push(agent._id);
    }
    project.currentAgentId = agent.nextAgentId || null;
    // This was the last agent in the route (no nextAgentId) — the whole
    // expert route is done, not just this stage. Only the route reaching
    // its end sets this; nothing else in the system ever flips
    // Project.status automatically (see Project.status field comment).
    if (!agent.nextAgentId) {
        project.status = 'completed';
    }
    project.lastActivityAt = new Date();
    await project.save();

    session.status = 'completed';
    session.outputSummary = artifact.summary;
    await session.save();

    return { artifact, nextAgentId: project.currentAgentId, projectContextVersion: project.contextVersion, confirmed: true };
}
