import { searchContext } from '../qdrant.service.js';

const SOURCE_TYPE_LABELS = {
    project_summary: 'Сводка проекта',
    agent_summary: 'Сводка предыдущего агента',
    artifact: 'Артефакт предыдущего этапа',
    file_chunk: 'Фрагмент файла проекта',
    user_note: 'Заметка пользователя'
};

// Server-only prompt assembly (CTX-1). Always includes the agent's system
// prompt + completion criteria + artifact definition, optionally the
// project's MongoDB summary, and a projectId-filtered Qdrant search capped
// by maxContextChars (CTX-2..CTX-6). Returns both the assembled system
// prompt and a snapshot of what was retrieved, for storing on the session
// (ExpertSession.inputContextSnapshot) — an audit trail of what the LLM
// actually saw.
export async function assembleContext({ project, agent, userMessageText }) {
    const systemParts = [agent.systemPrompt];

    systemParts.push(`Критерии завершения этапа:\n${agent.completionCriteria}`);
    systemParts.push(
        `Требуемый артефакт (artifactType: ${agent.artifactDefinition.artifactType}).\n` +
        `Обязательные поля: ${agent.artifactDefinition.requiredFields.join(', ') || '—'}.`
    );

    if (agent.contextPolicy.includeProjectSummary && project.contextSummary) {
        systemParts.push(`Сводка проекта:\n${project.contextSummary}`);
    }

    const sourceTypes = agent.contextPolicy.includePreviousArtifacts
        ? agent.contextPolicy.allowedSourceTypes
        : agent.contextPolicy.allowedSourceTypes.filter((t) => t !== 'artifact');

    const retrieved = await searchContext({
        projectId: project._id,
        sourceTypes,
        queryText: userMessageText,
        topK: agent.contextPolicy.qdrantTopK
    });

    let retrievedText = '';
    const usedChunks = [];
    for (const hit of retrieved) {
        const label = SOURCE_TYPE_LABELS[hit.payload.sourceType] || hit.payload.sourceType;
        const piece = `[${label}] ${hit.payload.text}`;
        if (retrievedText.length + piece.length > agent.contextPolicy.maxContextChars) break;
        retrievedText += `${piece}\n\n`;
        usedChunks.push({ sourceType: hit.payload.sourceType, sourceId: hit.payload.sourceId, chunkIndex: hit.payload.chunkIndex, score: hit.score });
    }

    if (retrievedText) {
        systemParts.push(`Релевантный контекст проекта:\n${retrievedText.trim()}`);
    }

    return {
        systemPrompt: systemParts.join('\n\n---\n\n'),
        contextSnapshot: {
            projectSummaryIncluded: Boolean(agent.contextPolicy.includeProjectSummary && project.contextSummary),
            retrievedChunks: usedChunks,
            assembledAt: new Date().toISOString()
        }
    };
}
