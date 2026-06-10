import request from 'supertest';
import app from '../app.js';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { createUser } from '../__fixtures__/user.fixture.js';
import { authCookie } from '../__fixtures__/auth.fixture.js';
import File from '../models/file.model.js';

// Реальные вызовы S3 — требуются переменные окружения:
// YANDEX_ACCESS_KEY_ID, YANDEX_SECRET_ACCESS_KEY, YANDEX_BUCKET

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

async function initiateUpload(user) {
    const res = await request(app)
        .post('/api/v1/file/multipart/initiate')
        .set('Cookie', authCookie(user._id, user.email))
        .send({ filename: 'test.mp4', mimetype: 'video/mp4', size: 1024 * 1024 * 10 });
    return res.body.data; // { uploadId, key }
}

async function abortUpload(user, { uploadId, key }) {
    await request(app)
        .post('/api/v1/file/multipart/abort')
        .set('Cookie', authCookie(user._id, user.email))
        .send({ uploadId, key });
}

async function uploadPartToS3(presignedUrl, buffer) {
    const res = await fetch(presignedUrl, {
        method: 'PUT',
        body: buffer,
        duplex: 'half',
        headers: { 'Content-Length': String(buffer.length) },
    });
    if (!res.ok) throw new Error(`S3 part upload failed: ${res.status}`);
    return res.headers.get('ETag');
}

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
        expect(typeof res.body.data.uploadId).toBe('string');
        expect(res.body.data.key).toMatch(/\.mp4$/);

        await abortUpload(user, res.body.data);
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
        const { uploadId, key } = await initiateUpload(user);

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId, key, partNumbers: [1, 2, 3] });

        expect(res.status).toBe(200);
        expect(res.body.data.urls).toHaveLength(3);
        expect(res.body.data.urls[0]).toContain('partNumber=1');
        expect(res.body.data.urls[1]).toContain('partNumber=2');
        expect(res.body.data.urls[2]).toContain('partNumber=3');

        await abortUpload(user, { uploadId, key });
    });

    it('возвращает 400 если partNumbers пустой массив', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'some-id', key: 'some-key.mp4', partNumbers: [] });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан uploadId', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ key: 'some-key.mp4', partNumbers: [1] });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан key', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'some-id', partNumbers: [1] });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app)
            .post('/api/v1/file/multipart/presign')
            .send({ uploadId: 'some-id', key: 'some-key.mp4', partNumbers: [1] });

        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// POST /file/multipart/complete
// ---------------------------------------------------------------------------

describe('POST /file/multipart/complete', () => {
    it('завершает upload и сохраняет файл в БД', async () => {
        const user = await createUser();
        const { uploadId, key } = await initiateUpload(user);

        const presignRes = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId, key, partNumbers: [1] });

        const partBuffer = Buffer.alloc(1024, 'a');
        const etag = await uploadPartToS3(presignRes.body.data.urls[0], partBuffer);

        const res = await request(app)
            .post('/api/v1/file/multipart/complete')
            .set('Cookie', authCookie(user._id, user.email))
            .send({
                uploadId,
                key,
                parts: [{ PartNumber: 1, ETag: etag }],
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1024,
            });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            name: 'video.mp4',
            type: 'video/mp4',
            source: 'user',
        });
        expect(res.body.data.url).toContain(key);
    });

    it('создаёт запись в БД с правильным uploadedBy', async () => {
        const user = await createUser();
        const { uploadId, key } = await initiateUpload(user);

        const presignRes = await request(app)
            .post('/api/v1/file/multipart/presign')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId, key, partNumbers: [1] });

        const partBuffer = Buffer.alloc(1024, 'b');
        const etag = await uploadPartToS3(presignRes.body.data.urls[0], partBuffer);

        await request(app)
            .post('/api/v1/file/multipart/complete')
            .set('Cookie', authCookie(user._id, user.email))
            .send({
                uploadId,
                key,
                parts: [{ PartNumber: 1, ETag: etag }],
                originalname: 'video.mp4',
                mimetype: 'video/mp4',
                size: 1024,
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
                uploadId: 'some-id',
                key: 'some-key.mp4',
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
                uploadId: 'some-id',
                key: 'some-key.mp4',
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
                uploadId: 'some-id',
                key: 'some-key.mp4',
                parts: [{ PartNumber: 1, ETag: '"etag-part-1"' }],
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
        const { uploadId, key } = await initiateUpload(user);

        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId, key });

        expect(res.status).toBe(200);
    });

    it('не создаёт запись в БД при отмене', async () => {
        const user = await createUser();
        const { uploadId, key } = await initiateUpload(user);

        await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId, key });

        const count = await File.countDocuments({ uploadedBy: user._id });
        expect(count).toBe(0);
    });

    it('возвращает 400 если не передан uploadId', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ key: 'some-key.mp4' });

        expect(res.status).toBe(400);
    });

    it('возвращает 400 если не передан key', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ uploadId: 'some-id' });

        expect(res.status).toBe(400);
    });

    it('возвращает 401 без токена', async () => {
        const res = await request(app)
            .post('/api/v1/file/multipart/abort')
            .send({ uploadId: 'some-id', key: 'some-key.mp4' });

        expect(res.status).toBe(401);
    });
});
