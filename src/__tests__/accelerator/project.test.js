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

describe('GET /accelerator/projects/:projectId', () => {
    it('возвращает проект владельцу', async () => {
        const owner = await createUser();
        const project = await Project.create({ ownerId: owner._id, name: 'Owner Project' });

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}`)
            .set('Cookie', authCookie(owner._id, owner.email));

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Owner Project');
    });

    it('возвращает 403 не владельцу', async () => {
        const owner = await createUser();
        const stranger = await createUser();
        const project = await Project.create({ ownerId: owner._id, name: 'Owner Project' });

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}`)
            .set('Cookie', authCookie(stranger._id, stranger.email));

        expect(res.status).toBe(403);
    });

    it('возвращает 404 для несуществующего проекта', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/accelerator/projects/507f1f77bcf86cd799439011')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(404);
    });

    it('возвращает 401 без авторизации', async () => {
        const res = await request(app).get('/api/v1/accelerator/projects/507f1f77bcf86cd799439011');
        expect(res.status).toBe(401);
    });
});

describe('PATCH /accelerator/projects/:projectId', () => {
    it('обновляет проект владельцу и обновляет lastActivityAt', async () => {
        const owner = await createUser();
        const project = await Project.create({ ownerId: owner._id, name: 'Owner Project', stage: 'idea' });
        const originalActivity = project.lastActivityAt;

        const res = await request(app)
            .patch(`/api/v1/accelerator/projects/${project._id}`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ name: 'Renamed', stage: 'mvp' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Renamed');
        expect(res.body.data.stage).toBe('mvp');
        expect(new Date(res.body.data.lastActivityAt).getTime()).toBeGreaterThanOrEqual(new Date(originalActivity).getTime());
    });

    it('возвращает 403 не владельцу', async () => {
        const owner = await createUser();
        const stranger = await createUser();
        const project = await Project.create({ ownerId: owner._id, name: 'Owner Project' });

        const res = await request(app)
            .patch(`/api/v1/accelerator/projects/${project._id}`)
            .set('Cookie', authCookie(stranger._id, stranger.email))
            .send({ name: 'Hijacked' });

        expect(res.status).toBe(403);
    });

    it('возвращает 404 для несуществующего проекта', async () => {
        const user = await createUser();

        const res = await request(app)
            .patch('/api/v1/accelerator/projects/507f1f77bcf86cd799439011')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'X' });

        expect(res.status).toBe(404);
    });

    it('возвращает 400 при stage вне allowlist', async () => {
        const owner = await createUser();
        const project = await Project.create({ ownerId: owner._id, name: 'Owner Project' });

        const res = await request(app)
            .patch(`/api/v1/accelerator/projects/${project._id}`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ stage: 'unicorn' });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 при попытке передать ownerId', async () => {
        const owner = await createUser();
        const stranger = await createUser();
        const project = await Project.create({ ownerId: owner._id, name: 'Owner Project' });

        const res = await request(app)
            .patch(`/api/v1/accelerator/projects/${project._id}`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ ownerId: stranger._id });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без авторизации', async () => {
        const res = await request(app)
            .patch('/api/v1/accelerator/projects/507f1f77bcf86cd799439011')
            .send({ name: 'X' });

        expect(res.status).toBe(401);
    });
});
