import request from 'supertest';
import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { createProgram, createLesson, createAgent } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Role from '../../models/role.model.js';
import User from '../../models/user.model.js';
import StudyProgram from '../../models/study/program.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser(permissions = [
    'study_programs.read',
    'study_programs.create',
    'study_programs.update',
    'study_programs.delete'
]) {
    const role = await Role.create({ name: 'admin', permissions });
    return createUser({ role: role._id });
}

// ─── Create ───────────────────────────────────────────────────────────────────

describe('POST /study/programs', () => {
    it('создаёт программу и генерирует qrCode', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .post('/api/v1/study/programs')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Program', sequential: true });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('New Program');
        expect(res.body.data.qrCode).toBeDefined();
    });

    it('возвращает 403 без нужного права', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/study/programs')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'New Program' });

        expect(res.status).toBe(403);
    });

    it('возвращает 400 при пустом name', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .post('/api/v1/study/programs')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: '' });

        expect(res.status).toBe(400);
    });
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe('GET /study/programs', () => {
    it('возвращает список программ', async () => {
        const admin = await createAdminUser();
        await createProgram({ name: 'Program A' });
        await createProgram({ name: 'Program B' });

        const res = await request(app)
            .get('/api/v1/study/programs')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });

    it('возвращает 403 без права', async () => {
        const user = await createUser();

        const res = await request(app)
            .get('/api/v1/study/programs')
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });
});

// ─── Get ──────────────────────────────────────────────────────────────────────

describe('GET /study/programs/:programId', () => {
    it('возвращает программу по ID', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({ name: 'Detailed Program' });

        const res = await request(app)
            .get(`/api/v1/study/programs/${program._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Detailed Program');
    });

    it('возвращает 404 для несуществующей программы', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .get('/api/v1/study/programs/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(404);
    });
});

// ─── Update ───────────────────────────────────────────────────────────────────

describe('PATCH /study/programs/:programId', () => {
    it('обновляет название программы', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({ name: 'Old Name' });

        const res = await request(app)
            .patch(`/api/v1/study/programs/${program._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Name' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('New Name');
    });

    it('обновляет qrCode при updateQRCode=true', async () => {
        const admin = await createAdminUser();
        const program = await createProgram();
        const oldQr = program.qrCode;

        const res = await request(app)
            .patch(`/api/v1/study/programs/${program._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ updateQRCode: true });

        expect(res.status).toBe(200);
        expect(res.body.data.qrCode).not.toBe(oldQr);
    });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe('DELETE /study/programs/:programId', () => {
    it('удаляет программу', async () => {
        const admin = await createAdminUser();
        const program = await createProgram();

        const res = await request(app)
            .delete(`/api/v1/study/programs/${program._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(await StudyProgram.findById(program._id)).toBeNull();
    });

    it('возвращает 404 для несуществующей программы', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .delete('/api/v1/study/programs/000000000000000000000001')
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(404);
    });
});

// ─── Join ─────────────────────────────────────────────────────────────────────

describe('POST /study/programs/join', () => {
    it('добавляет программу пользователю по qrCode', async () => {
        const program = await createProgram({ active: true });
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/study/programs/join')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ qrCode: program.qrCode });

        expect(res.status).toBe(200);
        expect(res.body.data.programId.toString()).toBe(program._id.toString());

        const updated = await User.findById(user._id);
        expect(updated.studyPrograms.map(String)).toContain(program._id.toString());
    });

    it('не дублирует программу при повторном join', async () => {
        const program = await createProgram({ active: true });
        const user = await createUser({ studyPrograms: [program._id] });

        await request(app)
            .post('/api/v1/study/programs/join')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ qrCode: program.qrCode });

        const updated = await User.findById(user._id);
        const count = updated.studyPrograms.filter(id => id.equals(program._id)).length;
        expect(count).toBe(1);
    });

    it('возвращает 404 при неверном qrCode', async () => {
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/study/programs/join')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ qrCode: 'nonexistent-qr-code' });

        expect(res.status).toBe(404);
    });
});

// ─── Modules ──────────────────────────────────────────────────────────────────

describe('POST /study/programs/:programId/modules', () => {
    it('добавляет модуль в программу', async () => {
        const admin = await createAdminUser();
        const program = await createProgram();

        const res = await request(app)
            .post(`/api/v1/study/programs/${program._id}/modules`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'Module 1' });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('Module 1');
    });
});

describe('PATCH /study/programs/:programId/modules/:moduleId', () => {
    it('переименовывает модуль', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({ modules: [{ name: 'Old Module' }] });
        const moduleId = program.modules[0]._id;

        const res = await request(app)
            .patch(`/api/v1/study/programs/${program._id}/modules/${moduleId}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Module' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('New Module');
    });
});

describe('DELETE /study/programs/:programId/modules/:moduleId', () => {
    it('удаляет модуль из программы', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({ modules: [{ name: 'To Delete' }] });
        const moduleId = program.modules[0]._id;

        const res = await request(app)
            .delete(`/api/v1/study/programs/${program._id}/modules/${moduleId}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        const updated = await StudyProgram.findById(program._id);
        expect(updated.modules).toHaveLength(0);
    });
});

// ─── Module Items ─────────────────────────────────────────────────────────────

describe('POST /study/programs/:programId/modules/:moduleId/items', () => {
    it('добавляет урок в модуль', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({ modules: [{ name: 'Module' }] });
        const moduleId = program.modules[0]._id;
        const lesson = await createLesson();

        const res = await request(app)
            .post(`/api/v1/study/programs/${program._id}/modules/${moduleId}/items`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ type: 'StudyLesson', itemId: lesson._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.data.type).toBe('StudyLesson');
        expect(res.body.data.itemId.toString()).toBe(lesson._id.toString());
    });
});

describe('DELETE /study/programs/:programId/modules/:moduleId/items/:itemId', () => {
    it('удаляет элемент из модуля', async () => {
        const admin = await createAdminUser();
        const lesson = await createLesson();
        const program = await createProgram({
            modules: [{ name: 'Module', items: [{ type: 'StudyLesson', item: lesson._id }] }]
        });
        const moduleId = program.modules[0]._id;
        const itemId = program.modules[0].items[0]._id;

        const res = await request(app)
            .delete(`/api/v1/study/programs/${program._id}/modules/${moduleId}/items/${itemId}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        const updated = await StudyProgram.findById(program._id);
        expect(updated.modules[0].items).toHaveLength(0);
    });
});

describe('PATCH /study/programs/:programId/modules/reorder', () => {
    it('меняет порядок модулей', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({
            modules: [{ name: 'Module A' }, { name: 'Module B' }, { name: 'Module C' }]
        });
        const [idA, idB, idC] = program.modules.map(m => m._id.toString());

        const res = await request(app)
            .patch(`/api/v1/study/programs/${program._id}/modules/reorder`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ moduleIds: [idC, idA, idB] });

        expect(res.status).toBe(200);
        expect(res.body.data[0]._id).toBe(idC);
        expect(res.body.data[1]._id).toBe(idA);
        expect(res.body.data[2]._id).toBe(idB);
    });

    it('сохраняет новый порядок в БД', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({
            modules: [{ name: 'First' }, { name: 'Second' }]
        });
        const [id1, id2] = program.modules.map(m => m._id.toString());

        await request(app)
            .patch(`/api/v1/study/programs/${program._id}/modules/reorder`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ moduleIds: [id2, id1] });

        const updated = await StudyProgram.findById(program._id);
        expect(updated.modules[0]._id.toString()).toBe(id2);
        expect(updated.modules[1]._id.toString()).toBe(id1);
    });

    it('возвращает 400 если moduleId не принадлежит программе', async () => {
        const admin = await createAdminUser();
        const program = await createProgram({ modules: [{ name: 'Module A' }] });

        const res = await request(app)
            .patch(`/api/v1/study/programs/${program._id}/modules/reorder`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ moduleIds: ['000000000000000000000001'] });

        expect(res.status).toBe(400);
    });

    it('возвращает 404 для несуществующей программы', async () => {
        const admin = await createAdminUser();

        const res = await request(app)
            .patch('/api/v1/study/programs/000000000000000000000001/modules/reorder')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ moduleIds: ['000000000000000000000002'] });

        expect(res.status).toBe(404);
    });
});

describe('PATCH /study/programs/:programId/modules/:moduleId/items/reorder', () => {
    it('меняет порядок элементов в модуле', async () => {
        const admin = await createAdminUser();
        const lesson1 = await createLesson({ name: 'L1' });
        const lesson2 = await createLesson({ name: 'L2' });
        const program = await createProgram({
            modules: [{
                name: 'Module',
                items: [
                    { type: 'StudyLesson', item: lesson1._id },
                    { type: 'StudyLesson', item: lesson2._id }
                ]
            }]
        });
        const moduleId = program.modules[0]._id;

        const reversed = [
            { type: 'StudyLesson', itemId: lesson2._id.toString() },
            { type: 'StudyLesson', itemId: lesson1._id.toString() }
        ];

        const res = await request(app)
            .patch(`/api/v1/study/programs/${program._id}/modules/${moduleId}/items/reorder`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ items: reversed });

        expect(res.status).toBe(200);
        expect(res.body.data[0].itemId.toString()).toBe(lesson2._id.toString());
        expect(res.body.data[1].itemId.toString()).toBe(lesson1._id.toString());
    });
});
