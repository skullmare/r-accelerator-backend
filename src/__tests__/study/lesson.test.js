import api from '../helpers/api.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { createLesson } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Role from '../../models/role.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

async function createAdminUser() {
    const role = await Role.create({
        name: 'admin',
        permissions: [
            'study_lessons.read',
            'study_lessons.create',
            'study_lessons.update',
            'study_lessons.delete'
        ]
    });
    return createUser({ role: role._id });
}

describe('POST /study/lessons', () => {
    it('создаёт урок', async () => {
        const admin = await createAdminUser();

        const res = await api
            .post('/api/v1/study/lessons')
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Lesson', content: { type: 'doc', content: [] } });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('New Lesson');
    });

    it('возвращает 403 без права', async () => {
        const user = await createUser();

        const res = await api
            .post('/api/v1/study/lessons')
            .set('Cookie', authCookie(user._id, user.email))
            .send({ name: 'Lesson', content: {} });

        expect(res.status).toBe(403);
    });
});

describe('GET /study/lessons/:lessonId', () => {
    it('возвращает полный урок с правильными ответами для admin', async () => {
        const admin = await createAdminUser();
        const lesson = await createLesson({
            name: 'Lesson with quiz',
            questions: [{
                questionText: 'Question?',
                answerOptions: [
                    { text: 'Wrong', isCorrect: false },
                    { text: 'Right', isCorrect: true }
                ]
            }]
        });

        const res = await api
            .get(`/api/v1/study/lessons/${lesson._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
        expect(res.body.data.questions[0].answerOptions.some(a => 'isCorrect' in a)).toBe(true);
    });
});

describe('PATCH /study/lessons/:lessonId', () => {
    it('обновляет поля урока', async () => {
        const admin = await createAdminUser();
        const lesson = await createLesson({ name: 'Old Name' });

        const res = await api
            .patch(`/api/v1/study/lessons/${lesson._id}`)
            .set('Cookie', authCookie(admin._id, admin.email))
            .send({ name: 'New Name' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('New Name');
    });
});

describe('DELETE /study/lessons/:lessonId', () => {
    it('удаляет урок', async () => {
        const admin = await createAdminUser();
        const lesson = await createLesson();

        const res = await api
            .delete(`/api/v1/study/lessons/${lesson._id}`)
            .set('Cookie', authCookie(admin._id, admin.email));

        expect(res.status).toBe(200);
    });
});
