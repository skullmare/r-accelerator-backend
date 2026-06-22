import request from 'supertest';
import app from '../app.js';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { createUser } from '../__fixtures__/user.fixture.js';
import { authCookie } from '../__fixtures__/auth.fixture.js';
import Role from '../models/role.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser(permissions) {
    const role = await Role.create({ name: 'admin', permissions });
    return createUser({ role: role._id });
}

describe('GET /roles/permissions', () => {
    it('возвращает список всех прав', async () => {
        const admin = await createAdminUser(['roles.read']);

        const res = await request(app)
            .get('/api/v1/roles/permissions')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).toHaveProperty('program');
        expect(res.body.data[0]).toHaveProperty('actions');
    });
});

describe('GET /roles', () => {
    it('возвращает список ролей', async () => {
        const admin = await createAdminUser(['roles.read']);
        await Role.create({ name: 'editor', permissions: ['users.read'] });

        const res = await request(app)
            .get('/api/v1/roles')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('возвращает 403 без права', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/roles')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });
});

describe('POST /roles', () => {
    it('создаёт роль с правами', async () => {
        const admin = await createAdminUser(['roles.create']);

        const res = await request(app)
            .post('/api/v1/roles')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'editor', permissions: ['users.read', 'roles.read'] });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('editor');
        expect(res.body.data.permissions).toContain('users.read');
    });

    it('возвращает 400 при невалидном праве', async () => {
        const admin = await createAdminUser(['roles.create']);

        const res = await request(app)
            .post('/api/v1/roles')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'bad', permissions: ['not.a.real.permission'] });

        expect(res.status).toBe(400);
    });
});

describe('GET /roles/:id', () => {
    it('возвращает роль по ID', async () => {
        const admin = await createAdminUser(['roles.read']);
        const role = await Role.create({ name: 'viewer', permissions: ['users.read'] });

        const res = await request(app)
            .get(`/api/v1/roles/${role._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('viewer');
    });

    it('возвращает 404 для несуществующей роли', async () => {
        const admin = await createAdminUser(['roles.read']);

        const res = await request(app)
            .get('/api/v1/roles/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(404);
    });
});

describe('PUT /roles/:id', () => {
    it('обновляет роль', async () => {
        const admin = await createAdminUser(['roles.update']);
        const role = await Role.create({ name: 'old', permissions: ['users.read'] });

        const res = await request(app)
            .put(`/api/v1/roles/${role._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'new', permissions: ['roles.read'] });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('new');
    });

    it('возвращает 403 при попытке изменить системную роль', async () => {
        const admin = await createAdminUser(['roles.update']);
        const systemRole = await Role.create({ name: 'system', permissions: ['users.read'], isSystem: true });

        const res = await request(app)
            .put(`/api/v1/roles/${systemRole._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'hacked' });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /roles/:id', () => {
    it('удаляет роль', async () => {
        const admin = await createAdminUser(['roles.delete']);
        const role = await Role.create({ name: 'temp', permissions: ['users.read'] });

        const res = await request(app)
            .delete(`/api/v1/roles/${role._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(await Role.findById(role._id)).toBeNull();
    });

    it('возвращает 403 при попытке удалить системную роль', async () => {
        const admin = await createAdminUser(['roles.delete']);
        const systemRole = await Role.create({ name: 'system', permissions: ['users.read'], isSystem: true });

        const res = await request(app)
            .delete(`/api/v1/roles/${systemRole._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(403);
        expect(await Role.findById(systemRole._id)).not.toBeNull();
    });
});
