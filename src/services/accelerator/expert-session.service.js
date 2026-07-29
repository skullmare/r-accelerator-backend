import Agent from '../../models/accelerator/agent.model.js';
import ExpertSession from '../../models/accelerator/expert-session.model.js';
import Message from '../../models/accelerator/message.model.js';
import Artifact from '../../models/accelerator/artifact.model.js';
import { assembleContext } from './context-assembly.service.js';
import { chatCompleteStream } from '../llm.service.js';
import { generateArtifact } from './artifact-generation.service.js';
import { evaluateCompletion, CompletionEvaluationError } from './completion-evaluation.service.js';
import { upsertChunks } from '../qdrant.service.js';
import { chunkText } from '../file-processing/chunker.js';

const MAX_CONTEXT_SUMMARY_CHARS = 4000;
const HISTORY_LIMIT = 30;

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

// Оценка готовности этапа + запись её на сессию. Вызывается после каждого
// ответа агента (живое состояние кнопки на фронте) и перед генерацией
// артефакта (гейт).
async function refreshCompletionState(session, agent, { history, lastMessageId }) {
    const evaluation = await evaluateCompletion({ agent, conversationMessages: history });

    session.completionState = {
        ...evaluation,
        evaluatedAt: new Date(),
        evaluatedAfterMessageId: lastMessageId ?? null
    };
    await session.save();

    return session.completionState;
}

function isCompletionStateStale(session, lastMessageId) {
    if (!session.completionState?.evaluatedAt) return true;
    if (!lastMessageId) return false;

    const evaluatedAfter = session.completionState.evaluatedAfterMessageId;
    return !evaluatedAfter || String(evaluatedAfter) !== String(lastMessageId);
}

// Блок статуса этапа для системного промпта агента. Замыкает петлю между
// двумя независимыми LLM-вызовами: без него агент не знает вердикта оценщика
// и вольно интерпретирует completionCriteria — прощается «удачи на следующем
// этапе!», пока оценщик держит этап неготовым, и пользователь видит два
// противоречащих друг другу сообщения на одном экране. Статус берётся с
// прошлого хода (оценка выполняется ПОСЛЕ ответа агента) — лаг в одно
// сообщение осознанный и безвредный: свежие реплики пользователя агент и
// так видит в истории диалога.
function buildStageStatusPrompt(session, agent) {
    const header =
        'Статус этапа (серверная оценка — единственный источник истины о завершённости, ' +
        'не противоречь ему):';

    if (session.completionState?.ready) {
        return `${header}\n` +
            'Все необходимые данные собраны. Можешь кратко подытожить и предложить пользователю ' +
            'нажать кнопку «Завершить этап», чтобы сформировать итоговый документ. ' +
            'Сам этап ты не завершаешь и на следующий этап не переводишь.';
    }

    const state = session.completionState;
    const missing = (state?.missingFields?.length
        ? state.missingFields
        : agent.artifactDefinition.requiredFields || []).join(', ');

    return `${header}\n` +
        'Этап ЕЩЁ НЕ готов к завершению.' +
        (missing ? ` Не собраны данные: ${missing}.` : '') +
        (state?.reason ? ` Пояснение оценщика: ${state.reason}` : '') +
        '\nНе сообщай пользователю, что этап завершён или что можно переходить к следующему этапу, ' +
        'не прощайся и не желай удачи на следующем этапе. Продолжай диалог и целенаправленно ' +
        'собирай недостающие данные, задавая вопросы по одному.';
}

// Delivers the agent's reply over SSE: onUserMessage fires as soon as the
// user's own message is persisted (so the UI can render it optimistically,
// before the LLM call even starts), onDelta fires per text fragment as the
// model streams its answer. The full assistant message is only persisted
// once the stream ends, so a dropped connection mid-stream can't leave a
// half-written message in the database.
export async function sendMessage(project, session, agent, content, { onUserMessage, onDelta, onEvaluationError } = {}) {
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

    const messages = [{ role: 'system', content: `${systemPrompt}\n\n---\n\n${buildStageStatusPrompt(session, agent)}` }];
    if (retrievedContextMessage) messages.push(retrievedContextMessage);
    messages.push(...history);

    let replyText, tokenUsage;
    try {
        ({ content: replyText, tokenUsage } = await chatCompleteStream({
            model: agent.modelConfig.model,
            temperature: agent.modelConfig.temperature,
            maxTokens: agent.modelConfig.maxTokens,
            messages,
            onDelta
        }));
    } catch (error) {
        // Whatever code the OpenAI SDK attaches (or none) gets normalized to
        // a stable, documented code — the SSE `error` event must not leak an
        // unpredictable provider-specific value to the frontend.
        error.code = error.code || 'LLM_PROVIDER_FAILED';
        throw error;
    }

    const assistantMessage = await Message.create({
        sessionId: session._id,
        projectId: project._id,
        senderType: 'assistant',
        content: replyText,
        tokenUsage
    });

    session.inputContextSnapshot = contextSnapshot;
    session.status = 'active';
    await session.save();

    // Готовность пересчитывается на каждый ход: фронт получает её в событии
    // done и по ней решает, показывать ли кнопку завершения этапа. Сбой
    // оценщика здесь намеренно не роняет диалог — сообщение агента уже
    // доставлено и сохранено, а гейт всё равно перепроверит состояние в
    // completeSession (там сбой оценки уже будет явной ошибкой).
    let completionState = session.completionState;
    try {
        completionState = await refreshCompletionState(session, agent, {
            history: [...history, { role: 'assistant', content: replyText }],
            lastMessageId: assistantMessage._id
        });
    } catch (error) {
        onEvaluationError?.(error);
    }

    return { userMessage, assistantMessage, completionState };
}

// Гейт завершения этапа. Пропускает дальше, только если оценщик считает
// собранными все обязательные данные — либо если администратор явно разрешил
// агенту завершаться с частичным результатом (allowPartialCompletion).
//
// Состояние берётся из session.completionState, но пересчитывается, если оно
// устарело (после оценки успели появиться новые сообщения) или его нет вовсе:
// гейт не должен опираться на снимок, снятый до половины диалога.
async function assertStageReady(session, agent, history) {
    if (agent.allowPartialCompletion) return;

    const lastMessage = await Message.findOne({ sessionId: session._id }).sort({ createdAt: -1 }).select('_id');

    let state = session.completionState;
    if (isCompletionStateStale(session, lastMessage?._id)) {
        try {
            state = await refreshCompletionState(session, agent, { history, lastMessageId: lastMessage?._id });
        } catch (error) {
            // В отличие от чата, здесь сбой оценщика — это явная ошибка:
            // молча пропустить незавершённый этап хуже, чем попросить повтор.
            const code = error instanceof CompletionEvaluationError ? error.code : 'COMPLETION_EVALUATION_FAILED';
            throw new ExpertSessionError(error.message, 502, code);
        }
    }

    if (!state?.ready) {
        throw new ExpertSessionError(
            'Этап ещё не готов к формированию артефакта: собраны не все необходимые данные',
            409,
            'STAGE_NOT_READY',
            {
                missingFields: state?.missingFields ?? agent.artifactDefinition.requiredFields,
                reason: state?.reason ?? 'Готовность этапа не оценена'
            }
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
        await assertStageReady(session, agent, history);

        const { systemPrompt, retrievedContextMessage } = await assembleContext({ project, agent, userMessageText: agent.completionCriteria });

        let generated;
        try {
            generated = await generateArtifact({ agent, project, systemPrompt, retrievedContextMessage, conversationMessages: history });
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
