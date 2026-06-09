import request from 'supertest';
import app from '../app.js';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { createUser } from '../__fixtures__/user.fixture.js';
import { authCookie } from '../__fixtures__/auth.fixture.js';
import File from '../models/file.model.js';

// Мокаем s3.service.js — реальные вызовы S3 в тестах не нужны
jest.mock('../services/s3.service.js', () => ({
    uploadFile: jest.fn(),
    generateKey: jest.fn(() => 'mocked-uuid.mp4'),
    buildUrl: jest.fn((key) => `https://storage.yandexcloud.net/test-bucket/${key}`),
    createMultipartUpload: jest.fn(async () => 'mock-upload-id'),
    getPresignedPartUrls: jest.fn(async ({ partNumbers }) =>
        partNumbers.map((n) => `https://storage.yandexcloud.net/presigned?part=${n}`)
    ),
    completeMultipartUpload: jest.fn(async ({ key }) =>
        `https://storage.yandexcloud.net/test-bucket/${key}`
    ),
    abortMultipartUpload: jest.fn(async () => {}),
}));

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

// ---------------------------------------------------------------------------
// POST /file/multipart/initiate
// ---------------------------------------------------------------------------

describe('POST /file/multipart/initiate', () => {
    it('возвращает uploadId и key', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/initiate')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ filename: 'video.mp4', mimetype: 'video/mp4', size: 1024 * 1024 * 500 });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            uploadId: 'mock-upload-id',
            key: 'mocked-uuid.mp4',
        });
    });

    it('возвращает 400 если не передан filename', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/initiate')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ mimetype: 'video/mp4', size: 1000 });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан mimetype', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/initiate')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ filename: 'video.mp4', size: 1000 });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если size <= 0', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/initiate')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ filename: 'video.mp4', mimetype: 'video/mp4', size: 0 });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app)
            .post('/api/v1/file/multipart/initiate')
            .send({ filename: 'video.mp4', mimetype: 'video/mp4', size: 1000 });

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// POST /file/multipart/presign
// ---------------------------------------------------------------------------

describe('POST /file/multipart/presign', () => {
    it('возвращает presigned URLs для каждой части', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'mock-upload-id', key: 'mocked-uuid.mp4', partNumbers: [1, 2, 3] });

        expect(res.status).toBe(200);
        expect(res.body.data.urls).toHaveLength(3);
        expect(res.body.data.urls[0]).toContain('part=1');
        expect(res.body.data.urls[1]).toContain('part=2');
        expect(res.body.data.urls[2]).toContain('part=3');
    });

    it('возвращает 400 если partNumbers пустой массив', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'mock-upload-id', key: 'mocked-uuid.mp4', partNumbers: [] });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан uploadId', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ key: 'mocked-uuid.mp4', partNumbers: [1] });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан key', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'mock-upload-id', partNumbers: [1] });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .send({ uploadId: 'mock-upload-id', key: 'mocked-uuid.mp4', partNumbers: [1] });

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// POST /file/multipart/complete
// ---------------------------------------------------------------------------

const validCompleteParts = [
    { PartNumber: 1, ETag: '"etag-part-1"' },
    { PartNumber: 2, ETag: '"etag-part-2"' },
];

describe('POST /file/multipart/complete', () => {
    it('завершает upload и сохраняет файл в БД', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/complete')
            .set('Cookie', authCookie(user._id, user.email))
            .send({
                uploadId: 'mock-upload-id',
                key: 'mocked-uuid.mp4',
                parts: validCompleteParts,
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1024 * 1024 * 500,
            });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            name: 'video.mp4',
            type: 'video/mp4',
            source: 'user',
        });
        expect(res.body.data.url).toContain('mocked-uuid.mp4');
    });

    it('создаёт запись в БД с правильным uploadedBy', async () => {
        const user = await createUser();

        await request(app)
            .post('/api/v1/file/multipart/complete')
            .set('Cookie', authCookie(user._id, user.email))
            .send({
                uploadId: 'mock-upload-id',
                key: 'mocked-uuid.mp4',
                parts: validCompleteParts,
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1000,
            });

        const file = await File.findOne({ uploadedBy: user._id });
        expect(file).not.toBeNull();
        expect(file.name).toBe('video.mp4');
    });

    it('возвращает 400 если parts пустой массив', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/complete')
            .set('Cookie', authCookie(user._id, user.email))
            .send({
                uploadId: 'mock-upload-id',
                key: 'mocked-uuid.mp4',
                parts: [],
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1000,
            });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если часть не содержит ETag', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/complete')
            .set('Cookie', authCookie(user._id, user.email))
            .send({
                uploadId: 'mock-upload-id',
                key: 'mocked-uuid.mp4',
                parts: [{ PartNumber: 1 }],
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1000,
            });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app)
            .post('/api/v1/file/multipart/complete')
            .send({
                uploadId: 'mock-upload-id',
                key: 'mocked-uuid.mp4',
                parts: validCompleteParts,
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1000,
            });

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// POST /file/multipart/abort
// ---------------------------------------------------------------------------

describe('POST /file/multipart/abort', () => {
    it('успешно отменяет незавершённый upload', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'mock-upload-id', key: 'mocked-uuid.mp4' });

        expect(res.status).toBe(200);
    });

    it('не создаёт запись в БД при отмене', async () => {
        const user = await createUser();

        await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'mock-upload-id', key: 'mocked-uuid.mp4' });

        const count = await File.countDocuments({ uploadedBy: user._id });
        expect(count).toBe(0);
    });

    it('возвращает 400 если не передан uploadId', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ key: 'mocked-uuid.mp4' });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан key', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'mock-upload-id' });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .send({ uploadId: 'mock-upload-id', key: 'mocked-uuid.mp4' });

        expect(res.status).toBe(401);
    });
});
