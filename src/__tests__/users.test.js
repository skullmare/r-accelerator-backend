import request from 'supertest';
import app from '../app.js';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { createUser } from '../__fixtures__/user.fixture.js';
import { authCookie } from '../__fixtures__/auth.fixture.js';
import Role from '../models/role.model.js';
import User from '../models/user.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser(permissions) {
    const role = await Role.create({ name: 'admin', permissions });
    return createUser({ role: role._id });
}

// ─── Users ────────────────────────────────────────────────────────────────────

describe('GET /users', () => {
    it('возвращает список пользователей', async () => {
        const admin = await createAdminUser(['users.read']);
        await createUser({ email: 'alice@test.com' });
        await createUser({ email: 'bob@test.com' });

        const res = await request(app)
            .get('/api/v1/users')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
        expect(res.body.data.pagination).toBeDefined();
    });

    it('фильтрует по email', async () => {
        const admin = await createAdminUser(['users.read']);
        await createUser({ email: 'findme@test.com' });
        await createUser({ email: 'other@test.com' });

        const res = await request(app)
            .get('/api/v1/users?email=findme@test.com')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.users).toHaveLength(1);
        expect(res.body.data.users[0].email).toBe('findme@test.com');
    });

    it('возвращает 403 без права', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/users')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });
});

describe('GET /users/:id', () => {
    it('возвращает пользователя по ID', async () => {
        const admin = await createAdminUser(['users.read']);
        const target = await createUser({ email: 'target@test.com' });

        const res = await request(app)
            .get(`/api/v1/users/${target._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe('target@test.com');
    });

    it('возвращает 404 для несуществующего пользователя', async () => {
        const admin = await createAdminUser(['users.read']);

        const res = await request(app)
            .get('/api/v1/users/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(404);
    });
});

describe('PATCH /users/:id', () => {
    it('обновляет данные пользователя', async () => {
        const admin = await createAdminUser(['users.update']);
        const target = await createUser();

        const res = await request(app)
            .patch(`/api/v1/users/${target._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ firstName: 'Ivan', city: 'Moscow' });

        expect(res.status).toBe(200);
        expect(res.body.data.firstName).toBe('Ivan');
        expect(res.body.data.city).toBe('Moscow');
    });

    it('возвращает 400 для системного пользователя', async () => {
        const admin = await createAdminUser(['users.update']);
        const systemUser = await createUser({ isSystem: true });

        const res = await request(app)
            .patch(`/api/v1/users/${systemUser._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ firstName: 'Hacker' });

        expect(res.status).toBe(400);
    });
});

describe('PUT /users/:id/role', () => {
    it('назначает роль пользователю', async () => {
        const role = await Role.create({ name: 'editor', permissions: ['users.read'] });
        const admin = await createAdminUser(['users_role.update']);
        const target = await createUser();

        const res = await request(app)
            .put(`/api/v1/users/${target._id}/role`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ role: role._id.toString() });

        expect(res.status).toBe(200);
        expect(res.body.data.role._id.toString()).toBe(role._id.toString());
    });

    it('снимает роль при role=null', async () => {
        const role = await Role.create({ name: 'editor', permissions: ['users.read'] });
        const admin = await createAdminUser(['users_role.update']);
        const target = await createUser({ role: role._id });

        const res = await request(app)
            .put(`/api/v1/users/${target._id}/role`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ role: null });

        expect(res.status).toBe(200);
        expect(res.body.data.role).toBeUndefined();
    });

    it('возвращает 400 для системного пользователя', async () => {
        const role = await Role.create({ name: 'editor', permissions: ['users.read'] });
        const admin = await createAdminUser(['users_role.update']);
        const systemUser = await createUser({ isSystem: true });

        const res = await request(app)
            .put(`/api/v1/users/${systemUser._id}/role`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ role: role._id.toString() });

        expect(res.status).toBe(400);
    });
});

// ─── Profile ──────────────────────────────────────────────────────────────────

describe('GET /profile', () => {
    it('возвращает профиль текущего пользователя', async () => {
        const user = await createUser({ email: 'me@test.com', firstName: 'Me' });

        const res = await request(app)
            .get('/api/v1/profile')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe('me@test.com');
        expect(res.body.data.firstName).toBe('Me');
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app).get('/api/v1/profile');
        expect(res.status).toBe(401);
    });
});

describe('PUT /profile', () => {
    it('обновляет профиль текущего пользователя', async () => {
        const user = await createUser();

        const res = await request(app)
            .put('/api/v1/profile')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ firstName: 'Updated', city: 'SPb' });

        expect(res.status).toBe(200);
        expect(res.body.data.firstName).toBe('Updated');
        expect(res.body.data.city).toBe('SPb');

        const updated = await User.findById(user._id);
        expect(updated.firstName).toBe('Updated');
    });
});
