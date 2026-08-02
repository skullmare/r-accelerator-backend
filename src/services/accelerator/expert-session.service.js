import { CONTEXT, LLM } from '../../../config/accelerator.config.js';
import Agent from '../../models/accelerator/agent.model.js';
import ExpertSession from '../../models/accelerator/expert-session.model.js';
import Message from '../../models/accelerator/message.model.js';
import Artifact from '../../models/accelerator/artifact.model.js';
import { assembleContext } from './context-assembly.service.js';
import { chatCompleteStream } from '../llm.service.js';
import { generateArtifact } from './artifact-generation.service.js';
import { applyToolCalls, buildStagePrompt, buildTools } from './data-collection.service.js';
import { upsertChunks } from '../qdrant.service.js';
import { chunkText } from '../file-processing/chunker.js';
import logger from '../../../config/logger.config.js';

const MAX_CONTEXT_SUMMARY_CHARS = 4000;
// Сколько раз за один ход агенту позволено вызвать инструменты. После этого
// финальный проход идёт с tool_choice: 'none' — модель физически не может
// вызвать тул снова и обязана ответить текстом. Жёсткий потолок стоимости
// хода (максимум два вызова LLM) и защита от зацикливания.
const MAX_TOOL_ROUNDS = 1;
// Message.content обязателен, и падать здесь, потеряв уже сохранённое
// сообщение пользователя, было бы хуже заглушки.
const EMPTY_REPLY_FALLBACK = 'Записал. Продолжим — что скажете?';

export class ExpertSessionError extends Error {
    constructor(message, status, code, details = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// Текущий агент проекта.
//
// Если currentAgentId не указывает на существующего агента — это либо новый
// проект (поле ещё не выставлено), либо администратор удалил агента посреди
// маршрута. В обоих случаях подставляем первого по order из ещё не пройденных
// и запоминаем: пользователь не должен упираться в тупик из-за пробела в
// данных.
//
// Единственное состояние, где агента честно нет, — пройденный маршрут
// (status: 'completed'). Иначе просмотр маршрута после финального агента
// молча перезапускал бы его с начала.
export async function resolveCurrentAgent(project) {
    const agent = project.currentAgentId ? await Agent.findById(project.currentAgentId) : null;
    if (agent) return agent;
    if (project.status === 'completed') return null;

    const fallback = await Agent.findOne({ _id: { $nin: project.completedAgentIds } }).sort({ order: 1 });
    if (fallback) {
        project.currentAgentId = fallback._id;
        await project.save();
    }

    return fallback;
}

// Следующий агент маршрута. Основа маршрута — order: следующий по порядку
// агент находится всегда, даже если администратор не связал агентов вручную.
// nextAgentId — необязательное переопределение для нелинейных маршрутов; если
// он указывает на удалённого агента, маршрут не рвётся, а продолжается по
// order. Возвращает null только если этот агент действительно последний.
export async function resolveNextAgent(agent) {
    if (agent.nextAgentId) {
        const explicit = await Agent.findById(agent.nextAgentId);
        if (explicit) return explicit;
    }

    return Agent.findOne({ order: { $gt: agent.order } }).sort({ order: 1 });
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

// Создаёт сессию с текущим агентом проекта — или возвращает уже открытую.
// agentId необязателен: без него сессия открывается с текущим агентом, что и
// нужно фронту в обычном сценарии «продолжить работу над проектом».
export async function createSession(project, agentId = null) {
    const currentAgent = await resolveCurrentAgent(project);
    if (!currentAgent) {
        throw new ExpertSessionError('Маршрут проекта пройден или агенты не заведены', 409, 'NO_CURRENT_AGENT');
    }
    if (agentId && !currentAgent._id.equals(agentId)) {
        throw new ExpertSessionError('Этот агент сейчас недоступен в маршруте проекта', 409, 'AGENT_NOT_CURRENT');
    }

    let session = await ExpertSession.findOne({
        projectId: project._id,
        agentId: currentAgent._id,
        status: 'active'
    }).sort({ createdAt: -1 });

    if (!session) {
        session = await ExpertSession.create({ projectId: project._id, agentId: currentAgent._id });
    }

    return { session, agent: currentAgent };
}

// Последние historyLimit сообщений в хронологическом порядке. Сортировка по
// убыванию — чтобы лимит отсекал СТАРЫЕ сообщения, а не свежие.
async function getSessionHistory(sessionId) {
    const messages = await Message.find({ sessionId }).sort({ createdAt: -1 }).limit(CONTEXT.historyLimit);
    return messages
        .reverse()
        .map((m) => ({ role: m.senderType === 'assistant' ? 'assistant' : 'user', content: m.content }));
}

// Ход диалога. onUserMessage срабатывает сразу после сохранения сообщения
// пользователя (фронт рисует его, не дожидаясь модели), onDelta — на каждый
// фрагмент ответа. Ответ агента сохраняется только после конца стрима, чтобы
// оборванное соединение не оставило в базе полусообщение.
export async function sendMessage(project, session, agent, content, { onUserMessage, onDelta, onDataUpdated } = {}) {
    if (session.status === 'completed') {
        throw new ExpertSessionError('Этап уже завершён', 409, 'SESSION_ALREADY_COMPLETED');
    }

    const userMessage = await Message.create({
        sessionId: session._id,
        projectId: project._id,
        senderType: 'user',
        content
    });
    onUserMessage?.(userMessage);

    const { systemPrompt, retrievedContextMessage } = await assembleContext({ project, agent, queryText: content });
    const history = await getSessionHistory(session._id);

    // Карточка этапа рендерится из базы прямо здесь, поэтому агент видит
    // состояние на ТЕКУЩИЙ ход.
    let messages = [{ role: 'system', content: `${systemPrompt}\n\n---\n\n${buildStagePrompt(agent, session)}` }];
    if (retrievedContextMessage) messages.push(retrievedContextMessage);
    messages.push(...history);

    const tools = buildTools();
    let replyText = '';
    let tokenUsage = null;
    let dataChanged = false;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        let roundText, roundUsage, toolCalls;
        try {
            ({ content: roundText, tokenUsage: roundUsage, toolCalls } = await chatCompleteStream({
                model: LLM.model,
                temperature: LLM.temperature,
                maxTokens: LLM.chatMaxTokens,
                messages,
                tools,
                toolChoice: round < MAX_TOOL_ROUNDS ? 'auto' : 'none',
                onDelta
            }));
        } catch (error) {
            // Код провайдера непредсказуем, а фронту нужен стабильный —
            // нормализуем.
            error.code = error.code || 'LLM_PROVIDER_FAILED';
            throw error;
        }

        // Текст доклеивается, а не заменяется: модель может выдать реплику и в
        // том же проходе вызвать инструмент.
        replyText += roundText;
        if (roundUsage) tokenUsage = roundUsage;

        if (!toolCalls?.length) break;

        const { toolMessages, changed } = applyToolCalls({ session, toolCalls });
        if (changed) dataChanged = true;

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

    await session.save();

    if (dataChanged) {
        onDataUpdated?.({ collectedData: session.collectedData, readyForArtifact: session.readyForArtifact });
    }

    return {
        userMessage,
        assistantMessage,
        collectedData: session.collectedData,
        readyForArtifact: session.readyForArtifact
    };
}

function appendContextSummary(project, agentName, artifactSummary) {
    const entry = `[${agentName}] ${artifactSummary}`;
    const combined = project.contextSummary ? `${project.contextSummary}\n\n${entry}` : entry;
    project.contextSummary = combined.length > MAX_CONTEXT_SUMMARY_CHARS
        ? combined.slice(combined.length - MAX_CONTEXT_SUMMARY_CHARS)
        : combined;
    project.contextVersion += 1;
}

// Индексация документа в Qdrant — не критичный шаг: итоги этапа всё равно
// уходят следующему агенту через Project.contextSummary, который подмешивается
// в промпт всегда. Поэтому сбой поиска не имеет права остановить пользователя
// на середине маршрута — он логируется, и этап завершается.
async function indexArtifact(project, agent, artifact) {
    try {
        await upsertChunks({
            projectId: project._id,
            agentId: String(agent._id),
            sourceType: 'artifact',
            sourceId: String(artifact._id),
            chunks: chunkText(artifact.documentMarkdown)
        });
    } catch (error) {
        logger.error(`Не удалось проиндексировать документ этапа ${artifact._id} в Qdrant: ${error.message}`);
    }
}

// Завершение этапа: один вызов создаёт документ, закрывает сессию и
// переключает проект на следующего агента.
//
// Двухфазного подтверждения (черновик -> confirm -> перегенерация) больше
// нет: каждая лишняя фаза — это ещё одно состояние, в котором проект может
// застрять, если фронт не сделал второй вызов. Сервер также НЕ блокирует
// завершение по готовности: readyForArtifact подсказывает фронту момент
// показать кнопку, но не может запереть пользователя на этапе.
//
// Повторный вызов на уже завершённой сессии идемпотентен — возвращает тот же
// документ, а не ошибку: двойной клик не должен выглядеть как сбой.
export async function completeSession(project, session, agent) {
    if (session.status === 'completed' && session.artifactId) {
        const existing = await Artifact.findById(session.artifactId);
        if (existing) {
            return {
                artifact: existing,
                nextAgentId: project.currentAgentId,
                projectContextVersion: project.contextVersion
            };
        }
    }

    const { systemPrompt, retrievedContextMessage } = await assembleContext({
        project,
        agent,
        queryText: agent.completionPrompt
    });
    const history = await getSessionHistory(session._id);

    let generated;
    try {
        generated = await generateArtifact({
            agent,
            project,
            systemPrompt,
            retrievedContextMessage,
            conversationMessages: history,
            collectedData: session.collectedData
        });
    } catch (error) {
        throw new ExpertSessionError(error.message, 502, error.code || 'LLM_PROVIDER_FAILED');
    }

    const artifact = await Artifact.create({
        projectId: project._id,
        expertSessionId: session._id,
        agentId: agent._id,
        title: generated.title,
        documentMarkdown: generated.documentMarkdown,
        summary: generated.summary,
        file: generated.file
    });

    session.artifactId = artifact._id;
    session.status = 'completed';
    await session.save();

    await indexArtifact(project, agent, artifact);

    const nextAgent = await resolveNextAgent(agent);

    appendContextSummary(project, agent.name, artifact.summary);
    if (!project.completedAgentIds.some((id) => id.equals(agent._id))) {
        project.completedAgentIds.push(agent._id);
    }
    project.currentAgentId = nextAgent?._id ?? null;
    // Следующего агента нет — маршрут пройден целиком. Это единственный
    // автоматический переход статуса проекта.
    if (!nextAgent) {
        project.status = 'completed';
    }
    project.lastActivityAt = new Date();
    await project.save();

    return {
        artifact,
        nextAgentId: project.currentAgentId,
        projectContextVersion: project.contextVersion
    };
}
