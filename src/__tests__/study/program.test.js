import api from '../helpers/api.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { createProgram } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Role from '../../models/role.model.js';
import User from '../../models/user.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser() {
    const role = await Role.create({
        name: 'admin',
        permissions: [
            'study_programs.read',
            'study_programs.create',
            'study_programs.update',
            'study_programs.delete'
        ]
    });
    const user = await createUser({ role: role._id });
    return user;
}

describe('POST /study/programs', () => {
    it('создаёт программу и генерирует qrCode', async () => {
        const admin = await createAdminUser();

        const res = await api
            .post('/api/v1/study/programs')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Program', sequential: true });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('New Program');
        expect(res.body.data.qrCode).toBeDefined();
    });

    it('возвращает 403 без нужного права', async () => {
        const user = await createUser();

        const res = await api
            .post('/api/v1/study/programs')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'New Program' });

        expect(res.status).toBe(403);
    });

    it('возвращает 400 при пустом name', async () => {
        const admin = await createAdminUser();

        const res = await api
            .post('/api/v1/study/programs')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: '' });

        expect(res.status).toBe(400);
    });
});

describe('POST /study/programs/join', () => {
    it('добавляет программу пользователю по qrCode', async () => {
        const program = await createProgram({ active: true });
        const user = await createUser();

        const res = await api
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

        await api
            .post('/api/v1/study/programs/join')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ qrCode: program.qrCode });

        const updated = await User.findById(user._id);
        const count = updated.studyPrograms.filter(id => id.equals(program._id)).length;
        expect(count).toBe(1);
    });

    it('возвращает 404 при неверном qrCode', async () => {
        const user = await createUser();

        const res = await api
            .post('/api/v1/study/programs/join')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ qrCode: 'nonexistent-qr-code' });

        expect(res.status).toBe(404);
    });
});

describe('POST /study/programs/:programId/modules', () => {
    it('добавляет модуль в программу', async () => {
        const admin = await createAdminUser();
        const program = await createProgram();

        const res = await api
            .post(`/api/v1/study/programs/${program._id}/modules`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'Module 1' });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('Module 1');
    });
});
