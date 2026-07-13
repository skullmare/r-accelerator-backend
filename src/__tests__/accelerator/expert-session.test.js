import request from 'supertest';

jest.mock('../../services/llm.service.js', () => ({
    // Only used by artifact generation now (messages use chatCompleteStream).
    chatComplete: jest.fn(async () => ({
        content: JSON.stringify({
            marketDescription: 'Описание рынка',
            nicheHypothesis: 'Гипотеза ниши',
            competitors: 'Конкуренты',
            risks: 'Риски',
            summary: 'Итоговая сводка по рынку'
        }),
        tokenUsage: { totalTokens: 42 }
    })),
    chatCompleteStream: jest.fn(async ({ onDelta }) => {
        const text = 'Ответ агента пользователю';
        onDelta?.(text);
        return { content: text, tokenUsage: null };
    })
}));

jest.mock('../../services/qdrant.service.js', () => ({
    searchContext: jest.fn().mockResolvedValue([]),
    upsertChunks: jest.fn().mockResolvedValue(['point-1']),
    deleteBySource: jest.fn().mockResolvedValue(undefined)
}));

import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Project from '../../models/accelerator/project.model.js';
import Agent from '../../models/accelerator/agent.model.js';
import { upsertChunks } from '../../services/qdrant.service.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

// SSE responses come back as raw "event: X\ndata: {...}\n\n" blocks.
function parseSSE(text) {
    return text
        .split('\n\n')
        .filter((block) => block.trim().length > 0)
        .map((block) => {
            const event = block.match(/^event: (.+)$/m)?.[1];
            const data = block.match(/^data: (.+)$/m)?.[1];
            return { event, data: data ? JSON.parse(data) : null };
        });
}

async function seedAgents() {
    const r2 = await Agent.create({
        name: 'Регина',
        roleTitle: 'Эксперт по аудитории',
        order: 2,
        nextAgentId: null,
        systemPrompt: 'Ты эксперт по аудитории.',
        completionCriteria: 'Собран бриф аудитории.',
        artifactDefinition: {
            artifactType: 'audience_brief',
            requiredFields: ['summary']
        }
    });
    const r1 = await Agent.create({
        name: 'Роман',
        roleTitle: 'Эксперт по рынку',
        order: 1,
        nextAgentId: r2._id,
        systemPrompt: 'Ты эксперт по рынку.',
        completionCriteria: 'Собран рыночный бриф.',
        artifactDefinition: {
            artifactType: 'market_brief',
            requiredFields: ['marketDescription', 'nicheHypothesis', 'competitors', 'risks', 'summary']
        }
    });
    return { r1, r2 };
}

async function setupProject() {
    const owner = await createUser();
    const project = await Project.create({ ownerId: owner._id, name: 'Стартап' });
    return { owner, project };
}

describe('Экспертный маршрут R1 -> R2 (сквозной сценарий)', () => {
    it('проходит create session -> message (SSE) -> draft complete -> confirm complete -> R2', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        expect(sessionRes.status).toBe(201);
        const sessionId = sessionRes.body.data.session._id;

        const messageRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Опишите рынок для моего проекта' });
        expect(messageRes.status).toBe(200);
        expect(messageRes.headers['content-type']).toMatch(/text\/event-stream/);

        const events = parseSSE(messageRes.text);
        const createdEvent = events.find((e) => e.event === 'message_created');
        const deltaEvents = events.filter((e) => e.event === 'delta');
        const doneEvent = events.find((e) => e.event === 'done');

        expect(createdEvent.data.userMessage.content).toBe('Опишите рынок для моего проекта');
        expect(deltaEvents.length).toBeGreaterThan(0);
        expect(deltaEvents.map((e) => e.data.text).join('')).toBe('Ответ агента пользователю');
        expect(doneEvent.data.assistantMessage.content).toBe('Ответ агента пользователю');

        const draftRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});
        expect(draftRes.status).toBe(200);
        expect(draftRes.body.data.artifact.status).toBe('ready');
        expect(draftRes.body.data.nextAgentId).toBeNull();

        const projectAfterDraft = await Project.findById(project._id);
        expect(String(projectAfterDraft.currentAgentId)).toBe(String(r1._id));

        const confirmRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.data.artifact.status).toBe('confirmed');
        expect(confirmRes.body.data.nextAgentId).toBe(String(r2._id));

        const projectAfterConfirm = await Project.findById(project._id);
        expect(String(projectAfterConfirm.currentAgentId)).toBe(String(r2._id));
        expect(projectAfterConfirm.completedAgentIds.map(String)).toContain(String(r1._id));
        expect(projectAfterConfirm.contextSummary).toContain('Итоговая сводка по рынку');

        expect(upsertChunks).toHaveBeenCalledWith(expect.objectContaining({
            projectId: project._id,
            agentId: String(r1._id),
            sourceType: 'artifact'
        }));

        const routeRes = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-route`)
            .set('Cookie', cookie);
        expect(routeRes.status).toBe(200);
        expect(routeRes.body.data.currentAgentId).toBe(String(r2._id));
        expect(routeRes.body.data.items).toEqual([
            { _id: String(r1._id), name: 'Роман', status: 'completed', nextAgentId: String(r2._id) },
            { _id: String(r2._id), name: 'Регина', status: 'current', nextAgentId: null }
        ]);

        const repeatCompleteRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(repeatCompleteRes.status).toBe(409);
    });

    it('чужой пользователь не может создать сессию в проекте (403)', async () => {
        const { r1 } = await seedAgents();
        const { project } = await setupProject();
        const stranger = await createUser();

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(stranger._id, stranger.email))
            .send({ agentId: String(r1._id) });

        expect(res.status).toBe(403);
    });

    it('возвращает 404 при создании сессии с несуществующим agentId', async () => {
        const { owner, project } = await setupProject();

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ agentId: '507f1f77bcf86cd799439099' });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('возвращает 409 JSON-ошибкой (не SSE), если сессия уже завершена', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Ещё вопрос' });

        expect(res.status).toBe(409);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
    });
});
