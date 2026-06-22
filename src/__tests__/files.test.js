import request from 'supertest';
import app from '../app.js';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { createUser } from '../__fixtures__/user.fixture.js';
import { authCookie } from '../__fixtures__/auth.fixture.js';
import File from '../models/file.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createFile(userId, overrides = {}) {
    return File.create({
        name: 'test.jpg',
        url: 'https://storage.example.com/test.jpg',
        type: 'image/jpeg',
        size: 12345,
        uploadedBy: userId,
        source: 'user',
        ...overrides
    });
}

describe('GET /file', () => {
    it('возвращает файлы текущего пользователя', async () => {
        const user = await createUser();
        await createFile(user._id);
        await createFile(user._id, { name: 'doc.pdf', type: 'application/pdf' });

        const res = await request(app)
            .get('/api/v1/file')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        expect(res.body.data.files).toHaveLength(2);
        expect(res.body.data.pagination.total).toBe(2);
    });

    it('не возвращает файлы других пользователей', async () => {
        const user = await createUser();
        const other = await createUser();
        await createFile(user._id);
        await createFile(other._id);

        const res = await request(app)
            .get('/api/v1/file')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        expect(res.body.data.files).toHaveLength(1);
    });

    it('фильтрует по source=user', async () => {
        const user = await createUser();
        await createFile(user._id, { source: 'user' });
        await createFile(user._id, { source: 'system' });

        const res = await request(app)
            .get('/api/v1/file?source=user')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        expect(res.body.data.files).toHaveLength(1);
        expect(res.body.data.files[0].source).toBe('user');
    });

    it('фильтрует по source=system', async () => {
        const user = await createUser();
        await createFile(user._id, { source: 'user' });
        await createFile(user._id, { source: 'system' });

        const res = await request(app)
            .get('/api/v1/file?source=system')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        expect(res.body.data.files).toHaveLength(1);
        expect(res.body.data.files[0].source).toBe('system');
    });

    it('возвращает 400 при невалидном source', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/file?source=invalid')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(400);
    });

    it('поддерживает пагинацию', async () => {
        const user = await createUser();
        await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
                createFile(user._id, { name: `file${i}.jpg` })
            )
        );

        const res = await request(app)
            .get('/api/v1/file?page=2&limit=2')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        expect(res.body.data.files).toHaveLength(2);
        expect(res.body.data.pagination).toMatchObject({
            page: 2,
            limit: 2,
            total: 5,
            totalPages: 3,
            hasMore: true
        });
    });

    it('возвращает 400 при limit > 100', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/file?limit=101')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app).get('/api/v1/file');
        expect(res.status).toBe(401);
    });
});
