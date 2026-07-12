import Agent from '../../models/accelerator/agent.model.js';
import ExpertSession from '../../models/accelerator/expert-session.model.js';
import Message from '../../models/accelerator/message.model.js';
import Artifact from '../../models/accelerator/artifact.model.js';
import { assembleContext } from './context-assembly.service.js';
import { chatComplete } from '../llm.service.js';
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
// currentAgentCode falls back to the first active agent by `order`,
// and that resolution is persisted so it only happens once.
export async function resolveCurrentAgent(project) {
    let agent = project.currentAgentCode
        ? await Agent.findOne({ code: project.currentAgentCode })
        : null;

    if (!agent) {
        agent = await Agent.findOne({ isActive: true }).sort({ order: 1 });
        if (agent) {
            project.currentAgentCode = agent.code;
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

    const agent = await Agent.findOne({ code: session.agentCode });
    if (!agent) {
        throw new ExpertSessionError('Агент сессии не найден', 404, 'AGENT_NOT_FOUND');
    }

    return { session, agent };
}

export async function createSession(project, agentCode) {
    const agent = await Agent.findOne({ code: agentCode, isActive: true });
    if (!agent) {
        throw new ExpertSessionError('Агент не найден или отключён', 404, 'AGENT_NOT_FOUND');
    }

    const currentAgent = await resolveCurrentAgent(project);
    if (!currentAgent || currentAgent.code !== agentCode) {
        throw new ExpertSessionError('Этот агент сейчас недоступен в маршруте проекта', 409, 'AGENT_NOT_CURRENT');
    }

    let session = await ExpertSession.findOne({
        projectId: project._id,
        agentCode,
        status: { $in: ['draft', 'active', 'waiting_user_confirmation'] }
    }).sort({ createdAt: -1 });

    if (!session) {
        session = await ExpertSession.create({ projectId: project._id, agentCode, status: 'active' });
    }

    return { session, agent };
}

async function getSessionHistory(sessionId) {
    const messages = await Message.find({ sessionId }).sort({ createdAt: 1 }).limit(HISTORY_LIMIT);
    return messages.map((m) => ({ role: m.senderType === 'assistant' ? 'assistant' : 'user', content: m.content }));
}

export async function sendMessage(project, session, agent, content) {
    if (session.status === 'completed') {
        throw new ExpertSessionError('Сессия уже завершена', 409, 'SESSION_ALREADY_COMPLETED');
    }

    const userMessage = await Message.create({
        sessionId: session._id,
        projectId: project._id,
        senderType: 'user',
        content
    });

    const { systemPrompt, contextSnapshot } = await assembleContext({ project, agent, userMessageText: content });
    const history = await getSessionHistory(session._id);

    const { content: replyText, tokenUsage } = await chatComplete({
        provider: agent.modelConfig.provider,
        model: agent.modelConfig.model,
        temperature: agent.modelConfig.temperature,
        maxTokens: agent.modelConfig.maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...history]
    });

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
// Project.currentAgentCode via Agent.nextAgentCode, folds the artifact
// summary into Project.contextSummary, and indexes it into Qdrant.
export async function completeSession(project, session, agent, confirmArtifact) {
    if (session.status === 'completed') {
        throw new ExpertSessionError('Сессия уже завершена', 409, 'SESSION_ALREADY_COMPLETED');
    }

    let artifact = session.artifactId ? await Artifact.findById(session.artifactId) : null;

    if (!artifact) {
        const history = await getSessionHistory(session._id);
        const { systemPrompt } = await assembleContext({ project, agent, userMessageText: agent.completionCriteria });

        let generated;
        try {
            generated = await generateArtifactJson({ agent, systemPrompt, conversationMessages: history });
        } catch (error) {
            throw new ExpertSessionError(error.message, 422, error.code || 'ARTIFACT_VALIDATION_FAILED');
        }

        artifact = await Artifact.create({
            projectId: project._id,
            expertSessionId: session._id,
            agentCode: agent.code,
            type: agent.artifactDefinition.artifactType,
            title: generated.title,
            content: generated.content,
            summary: generated.summary,
            status: 'draft'
        });

        session.artifactId = artifact._id;
    }

    if (!confirmArtifact) {
        artifact.status = 'ready';
        await artifact.save();

        session.status = 'waiting_user_confirmation';
        session.outputSummary = artifact.summary;
        await session.save();

        return { artifact, nextAgentCode: null, projectContextVersion: project.contextVersion, confirmed: false };
    }

    artifact.status = 'confirmed';
    await artifact.save();

    await upsertChunks({
        projectId: project._id,
        agentCode: agent.code,
        sourceType: 'artifact',
        sourceId: String(artifact._id),
        chunks: chunkText(JSON.stringify(artifact.content))
    });

    appendContextSummary(project, agent.name, artifact.summary);
    if (!project.completedAgentCodes.includes(agent.code)) {
        project.completedAgentCodes.push(agent.code);
    }
    project.currentAgentCode = agent.nextAgentCode || null;
    project.lastActivityAt = new Date();
    await project.save();

    session.status = 'completed';
    session.outputSummary = artifact.summary;
    await session.save();

    return { artifact, nextAgentCode: project.currentAgentCode, projectContextVersion: project.contextVersion, confirmed: true };
}
