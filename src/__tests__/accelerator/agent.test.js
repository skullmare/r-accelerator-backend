import request from 'supertest';
import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Role from '../../models/role.model.js';
import Agent from '../../models/accelerator/agent.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser() {
    const role = await Role.create({ name: 'agents-admin', permissions: ['accelerator_agents.manage'] });
    return createUser({ role: role._id });
}

function agentPayload(overrides = {}) {
    return {
        name: 'Роман',
        roleTitle: 'Эксперт по рынку',
        order: 1,
        systemPrompt: 'Ты эксперт по рынку и нише.',
        completionCriteria: 'Собраны marketDescription, nicheHypothesis, competitors, risks.',
        artifactDefinition: {
            artifactType: 'market_brief',
            requiredFields: ['marketDescription', 'nicheHypothesis', 'competitors', 'risks', 'summary']
        },
        ...overrides
    };
}

describe('POST /accelerator/admin/agents', () => {
    it('создаёт агента, идентифицируемого по _id (без отдельного человекочитаемого кода)', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .post('/api/v1/accelerator/admin/agents')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send(agentPayload({ name: 'Коуч' }));

        expect(res.status).toBe(201);
        expect(res.body.data._id).toEqual(expect.any(String));
        expect(res.body.data.code).toBeUndefined();
        expect(res.body.data.contextPolicy.qdrantTopK).toBe(6);
        expect(res.body.data.modelConfig.model).toBe('gpt-4o-mini');
        expect(res.body.data.modelConfig.provider).toBeUndefined();
    });

    it('возвращает 403 без права accelerator_agents.manage', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/accelerator/admin/agents')
            .set('Cookie', authCookie(user._id, user.email))
            .send(agentPayload());

        expect(res.status).toBe(403);
    });

    it('возвращает 401 без авторизации', async () => {
        const res = await request(app)
            .post('/api/v1/accelerator/admin/agents')
            .send(agentPayload());

        expect(res.status).toBe(401);
    });

    it('возвращает 400 если nextAgentId ссылается на несуществующего агента', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .post('/api/v1/accelerator/admin/agents')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send(agentPayload({ nextAgentId: '507f1f77bcf86cd799439099' }));

        expect(res.status).toBe(400);
    });

    it('создаёт R1 -> R2 маршрут по _id, когда R2 уже существует', async () => {
        const admin = await createAdminUser();
        const regina = await Agent.create(agentPayload({ name: 'Регина', order: 2 }));

        const res = await request(app)
            .post('/api/v1/accelerator/admin/agents')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send(agentPayload({ nextAgentId: String(regina._id) }));

        expect(res.status).toBe(201);
        expect(res.body.data.nextAgentId).toBe(String(regina._id));
    });
});

describe('GET /accelerator/admin/agents', () => {
    it('возвращает список агентов, отсортированный по order', async () => {
        const admin = await createAdminUser();
        await Agent.create(agentPayload({ name: 'Регина', order: 2 }));
        await Agent.create(agentPayload({ name: 'Роман', order: 1 }));

        const res = await request(app)
            .get('/api/v1/accelerator/admin/agents')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.map((a) => a.name)).toEqual(['Роман', 'Регина']);
    });

    it('обычный пользователь не видит systemPrompt агентов (403)', async () => {
        const user = await createUser();
        await Agent.create(agentPayload());

        const res = await request(app)
            .get('/api/v1/accelerator/admin/agents')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });
});

describe('PATCH /accelerator/admin/agents/:agentId', () => {
    it('позволяет временно отключить агента (isActive=false)', async () => {
        const admin = await createAdminUser();
        const agent = await Agent.create(agentPayload());

        const res = await request(app)
            .patch(`/api/v1/accelerator/admin/agents/${agent._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ isActive: false });

        expect(res.status).toBe(200);
        expect(res.body.data.isActive).toBe(false);
    });

    it('возвращает 404 для несуществующего агента', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .patch('/api/v1/accelerator/admin/agents/507f1f77bcf86cd799439011')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ isActive: false });

        expect(res.status).toBe(404);
    });

    it('возвращает 400 если nextAgentId ссылается на несуществующего агента', async () => {
        const admin = await createAdminUser();
        const agent = await Agent.create(agentPayload());

        const res = await request(app)
            .patch(`/api/v1/accelerator/admin/agents/${agent._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ nextAgentId: '507f1f77bcf86cd799439099' });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 при самоссылке nextAgentId (вечный цикл этапа)', async () => {
        const admin = await createAdminUser();
        const agent = await Agent.create(agentPayload());

        const res = await request(app)
            .patch(`/api/v1/accelerator/admin/agents/${agent._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ nextAgentId: String(agent._id) });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('NEXT_AGENT_SELF_REFERENCE');

        const after = await Agent.findById(agent._id);
        expect(after.nextAgentId).toBeNull();
    });
});
