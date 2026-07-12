import request from 'supertest';

jest.mock('../../services/llm.service.js', () => ({
    chatComplete: jest.fn(async ({ messages }) => {
        const last = messages[messages.length - 1];
        if (last.content.includes('Сформируй финальный артефакт')) {
            return {
                content: JSON.stringify({
                    marketDescription: 'Описание рынка',
                    nicheHypothesis: 'Гипотеза ниши',
                    competitors: 'Конкуренты',
                    risks: 'Риски',
                    summary: 'Итоговая сводка по рынку'
                }),
                tokenUsage: { totalTokens: 42 }
            };
        }
        return { content: 'Ответ агента пользователю', tokenUsage: null };
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
import Role from '../../models/role.model.js';
import Project from '../../models/accelerator/project.model.js';
import Agent from '../../models/accelerator/agent.model.js';
import { upsertChunks } from '../../services/qdrant.service.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

async function seedAgents() {
    await Agent.create({
        code: 'R1',
        name: 'Роман',
        roleTitle: 'Эксперт по рынку',
        order: 1,
        nextAgentCode: 'R2',
        systemPrompt: 'Ты эксперт по рынку.',
        completionCriteria: 'Собран рыночный бриф.',
        artifactDefinition: {
            artifactType: 'market_brief',
            requiredFields: ['marketDescription', 'nicheHypothesis', 'competitors', 'risks', 'summary']
        }
    });
    await Agent.create({
        code: 'R2',
        name: 'Регина',
        roleTitle: 'Эксперт по аудитории',
        order: 2,
        nextAgentCode: null,
        systemPrompt: 'Ты эксперт по аудитории.',
        completionCriteria: 'Собран бриф аудитории.',
        artifactDefinition: {
            artifactType: 'audience_brief',
            requiredFields: ['summary']
        }
    });
}

async function setupProject() {
    const owner = await createUser();
    const project = await Project.create({ ownerId: owner._id, name: 'Стартап' });
    return { owner, project };
}

describe('Экспертный маршрут R1 -> R2 (сквозной сценарий)', () => {
    it('проходит create session -> message -> draft complete -> confirm complete -> R2', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentCode: 'R1' });
        expect(sessionRes.status).toBe(201);
        const sessionId = sessionRes.body.data.session._id;

        const messageRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Опишите рынок для моего проекта' });
        expect(messageRes.status).toBe(200);
        expect(messageRes.body.data.assistantMessage.content).toBe('Ответ агента пользователю');

        const draftRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});
        expect(draftRes.status).toBe(200);
        expect(draftRes.body.data.artifact.status).toBe('ready');
        expect(draftRes.body.data.nextAgentCode).toBeNull();

        const projectAfterDraft = await Project.findById(project._id);
        expect(projectAfterDraft.currentAgentCode).toBe('R1');

        const confirmRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.data.artifact.status).toBe('confirmed');
        expect(confirmRes.body.data.nextAgentCode).toBe('R2');

        const projectAfterConfirm = await Project.findById(project._id);
        expect(projectAfterConfirm.currentAgentCode).toBe('R2');
        expect(projectAfterConfirm.completedAgentCodes).toContain('R1');
        expect(projectAfterConfirm.contextSummary).toContain('Итоговая сводка по рынку');

        expect(upsertChunks).toHaveBeenCalledWith(expect.objectContaining({
            projectId: project._id,
            agentCode: 'R1',
            sourceType: 'artifact'
        }));

        const routeRes = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-route`)
            .set('Cookie', cookie);
        expect(routeRes.status).toBe(200);
        expect(routeRes.body.data.currentAgentCode).toBe('R2');
        expect(routeRes.body.data.items).toEqual([
            { code: 'R1', name: 'Роман', status: 'completed', nextAgentCode: 'R2' },
            { code: 'R2', name: 'Регина', status: 'current', nextAgentCode: null }
        ]);

        const repeatCompleteRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(repeatCompleteRes.status).toBe(409);
    });

    it('чужой пользователь не может создать сессию в проекте (403)', async () => {
        await seedAgents();
        const { project } = await setupProject();
        const stranger = await createUser();

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(stranger._id, stranger.email))
            .send({ agentCode: 'R1' });

        expect(res.status).toBe(403);
    });

    it('возвращает 404 при создании сессии с несуществующим agentCode', async () => {
        const { owner, project } = await setupProject();

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ agentCode: 'GHOST' });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
    });
});
