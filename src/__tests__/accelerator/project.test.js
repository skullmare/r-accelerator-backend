import request from 'supertest';
import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Project from '../../models/accelerator/project.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

describe('POST /accelerator/projects', () => {
    it('создаёт проект с owner = текущий пользователь', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/accelerator/projects')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'My Startup', stage: 'mvp' });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('My Startup');
        expect(res.body.data.ownerId).toBe(String(user._id));
    });

    it('возвращает 400 без name', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/accelerator/projects')
            .set('Cookie', authCookie(user._id, user.email))
            .send({});

        expect(res.status).toBe(400);
    });

    it('возвращает 400 при stage вне allowlist', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/accelerator/projects')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'My Startup', stage: 'unicorn' });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 при лишнем поле', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/accelerator/projects')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'My Startup', progress: 90 });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без авторизации', async () => {
        const res = await request(app)
            .post('/api/v1/accelerator/projects')
            .send({ name: 'My Startup' });

        expect(res.status).toBe(401);
    });
});

describe('GET /accelerator/projects', () => {
    it('возвращает только проекты текущего пользователя', async () => {
        const owner = await createUser();
        const stranger = await createUser();

        await Project.create({ ownerId: owner._id, name: 'Owner Project' });
        await Project.create({ ownerId: stranger._id, name: 'Stranger Project' });

        const res = await request(app)
            .get('/api/v1/accelerator/projects')
            .set('Cookie', authCookie(owner._id, owner.email));

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe('Owner Project');
    });

    it('возвращает 401 без авторизации', async () => {
        const res = await request(app).get('/api/v1/accelerator/projects');
        expect(res.status).toBe(401);
    });
});
