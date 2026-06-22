import request from 'supertest';
import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { createAgent } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Role from '../../models/role.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser(permissions) {
    const role = await Role.create({ name: 'admin', permissions });
    return createUser({ role: role._id });
}

const agentPayload = {
    name: 'Test Agent',
    description: 'A helpful agent',
    avatar: 'https://example.com/avatar.png',
    openAiAssistantId: 'asst_abc123'
};

describe('GET /study/agents', () => {
    it('возвращает список агентов', async () => {
        const admin = await createAdminUser(['study_agents.read']);
        await createAgent({ name: 'Agent 1' });
        await createAgent({ name: 'Agent 2' });

        const res = await request(app)
            .get('/api/v1/study/agents')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });

    it('возвращает 403 без права', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/study/agents')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });
});

describe('POST /study/agents', () => {
    it('создаёт агента', async () => {
        const admin = await createAdminUser(['study_agents.create']);

        const res = await request(app)
            .post('/api/v1/study/agents')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send(agentPayload);

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('Test Agent');
        expect(res.body.data.openAiAssistantId).toBe('asst_abc123');
    });

    it('возвращает 400 при отсутствии обязательных полей', async () => {
        const admin = await createAdminUser(['study_agents.create']);

        const res = await request(app)
            .post('/api/v1/study/agents')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'Incomplete' });

        expect(res.status).toBe(400);
    });

    it('возвращает 403 без права', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/study/agents')
            .set('Cookie', authCookie(user._id, user.email))
            .send(agentPayload);

        expect(res.status).toBe(403);
    });
});

describe('GET /study/agents/:id', () => {
    it('возвращает агента по ID', async () => {
        const admin = await createAdminUser(['study_agents.read']);
        const agent = await createAgent({ name: 'My Agent' });

        const res = await request(app)
            .get(`/api/v1/study/agents/${agent._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('My Agent');
    });

    it('возвращает 404 для несуществующего агента', async () => {
        const admin = await createAdminUser(['study_agents.read']);

        const res = await request(app)
            .get('/api/v1/study/agents/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(404);
    });
});

describe('PATCH /study/agents/:id', () => {
    it('обновляет агента', async () => {
        const admin = await createAdminUser(['study_agents.update']);
        const agent = await createAgent({ name: 'Old Name' });

        const res = await request(app)
            .patch(`/api/v1/study/agents/${agent._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Name' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('New Name');
    });

    it('возвращает 404 для несуществующего агента', async () => {
        const admin = await createAdminUser(['study_agents.update']);

        const res = await request(app)
            .patch('/api/v1/study/agents/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'X' });

        expect(res.status).toBe(404);
    });
});

describe('DELETE /study/agents/:id', () => {
    it('удаляет агента', async () => {
        const admin = await createAdminUser(['study_agents.delete']);
        const agent = await createAgent();

        const res = await request(app)
            .delete(`/api/v1/study/agents/${agent._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
    });

    it('возвращает 404 для несуществующего агента', async () => {
        const admin = await createAdminUser(['study_agents.delete']);

        const res = await request(app)
            .delete('/api/v1/study/agents/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(404);
    });
});
