import Agent from '../../models/accelerator/agent.model.js';
import ExpertSession from '../../models/accelerator/expert-session.model.js';
import Message from '../../models/accelerator/message.model.js';
import Artifact from '../../models/accelerator/artifact.model.js';
import { assembleContext } from './context-assembly.service.js';
import { chatCompleteStream } from '../llm.service.js';
import { generateArtifactJson } from './artifact-generation.service.js';
import { upsertChunks } from '../qdrant.service.js';
import { chunkText } from '../file-processing/chunker.js';

const MAX_CONTEXT_SUMMARY_CHARS = 4000;
const HISTORY_LIMIT = 30;

export class ExpertSessionError extends Error {
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// Self-healing fallback for EXP-2: an old/new project with no
// currentAgentId falls back to the first active agent by `order`,
// and that resolution is persisted so it only happens once.
export async function resolveCurrentAgent(project) {
    let agent = project.currentAgentId
        ? await Agent.findById(project.currentAgentId)
        : null;

    if (!agent) {
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

async function getSessionHistory(sessionId) {
    const messages = await Message.find({ sessionId }).sort({ createdAt: 1 }).limit(HISTORY_LIMIT);
    return messages.map((m) => ({ role: m.senderType === 'assistant' ? 'assistant' : 'user', content: m.content }));
}

// Delivers the agent's reply over SSE: onUserMessage fires as soon as the
// user's own message is persisted (so the UI can render it optimistically,
// before the LLM call even starts), onDelta fires per text fragment as the
// model streams its answer. The full assistant message is only persisted
// once the stream ends, so a dropped connection mid-stream can't leave a
// half-written message in the database.
export async function sendMessage(project, session, agent, content, { onUserMessage, onDelta } = {}) {
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

    const messages = [{ role: 'system', content: systemPrompt }];
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

    return { userMessage, assistantMessage };
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
export async function completeSession(project, session, agent, confirmArtifact) {
    if (session.status === 'completed') {
        throw new ExpertSessionError('Сессия уже завершена', 409, 'SESSION_ALREADY_COMPLETED');
    }

    let artifact = session.artifactId ? await Artifact.findById(session.artifactId) : null;

    if (!artifact) {
        const history = await getSessionHistory(session._id);
        const { systemPrompt, retrievedContextMessage } = await assembleContext({ project, agent, userMessageText: agent.completionCriteria });

        let generated;
        try {
            generated = await generateArtifactJson({ agent, systemPrompt, retrievedContextMessage, conversationMessages: history });
        } catch (error) {
            // Only a real structural/JSON validation failure (tagged by
            // artifact-generation.service.js) is actually ARTIFACT_VALIDATION_FAILED.
            // Anything else here (network error, rate limit, auth failure —
            // generateArtifactJson's own LLM call throwing) is a provider
            // failure and must not be mislabeled as "your artifact is invalid".
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

    artifact.status = 'confirmed';
    await artifact.save();

    try {
        await upsertChunks({
            projectId: project._id,
            agentId: String(agent._id),
            sourceType: 'artifact',
            sourceId: String(artifact._id),
            chunks: chunkText(JSON.stringify(artifact.content))
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
