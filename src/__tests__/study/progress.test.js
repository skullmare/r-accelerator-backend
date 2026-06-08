import api from '../helpers/api.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUserInProgram } from '../../__fixtures__/user.fixture.js';
import { createProgramWithItems } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import StudyProgress from '../../models/study/progress.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

describe('GET /study/programs/:programId/progress', () => {
    it('возвращает программу с флагами accessible и completed', async () => {
        const { program, lesson1, lesson2, agent } = await createProgramWithItems({ sequential: true });
        const user = await createUserInProgram(program._id);

        await StudyProgress.create({
            user: user._id,
            program: program._id,
            completedItems: [lesson1._id]
        });

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`)
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);

        const items = res.body.data.modules[0].items;
        const l1 = items.find(i => i.item._id.toString() === lesson1._id.toString());
        const agentItem = items.find(i => i.item._id.toString() === agent._id.toString());
        const l2 = items.find(i => i.item._id.toString() === lesson2._id.toString());

        expect(l1.completed).toBe(true);
        expect(l1.accessible).toBe(true);
        expect(agentItem.accessible).toBe(true);
        expect(l2.accessible).toBe(true);
        expect(l2.completed).toBe(false);
    });

    it('при sequential=true второй урок недоступен без прогресса', async () => {
        const { program, lesson1, lesson2 } = await createProgramWithItems({ sequential: true });
        const user = await createUserInProgram(program._id);

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`)
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        const items = res.body.data.modules[0].items;
        const l1 = items.find(i => i.item._id.toString() === lesson1._id.toString());
        const l2 = items.find(i => i.item._id.toString() === lesson2._id.toString());

        expect(l1.accessible).toBe(true);
        expect(l2.accessible).toBe(false);
    });

    it('при sequential=false все элементы доступны', async () => {
        const { program } = await createProgramWithItems({ sequential: false });
        const user = await createUserInProgram(program._id);

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`)
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(200);
        const items = res.body.data.modules[0].items;
        expect(items.every(i => i.accessible)).toBe(true);
    });
});

describe('POST /study/programs/:programId/lessons/:lessonId/complete', () => {
    it('добавляет урок в completedItems', async () => {
        const { program, lesson1 } = await createProgramWithItems({ sequential: true });
        const user = await createUserInProgram(program._id);

        const res = await api
            .post(`/api/v1/study/programs/${program._id}/lessons/${lesson1._id}/complete`)
            .set('Cookie', authCookie(user._id, user.email))
            .send({ quizAnswers: [] });

        expect(res.status).toBe(200);

        const progress = await StudyProgress.findOne({ user: user._id, program: program._id });
        expect(progress.completedItems.map(String)).toContain(lesson1._id.toString());
    });

    it('сохраняет ответы на тест', async () => {
        const { program, lesson1 } = await createProgramWithItems({ sequential: true });
        const user = await createUserInProgram(program._id);

        const fullLesson = await (await import('../../models/study/lesson.model.js')).default.findById(lesson1._id);
        const questionId = fullLesson.questions[0]?._id;

        if (!questionId) return;

        const answerId = fullLesson.questions[0].answerOptions[0]._id;

        await api
            .post(`/api/v1/study/programs/${program._id}/lessons/${lesson1._id}/complete`)
            .set('Cookie', authCookie(user._id, user.email))
            .send({ quizAnswers: [{ questionId, answerId }] });

        const progress = await StudyProgress.findOne({ user: user._id, program: program._id });
        const detail = progress.lessonDetails.find(d => d.item.equals(lesson1._id));
        expect(detail).toBeDefined();
        expect(detail.quizAnswers).toHaveLength(1);
    });

    it('повторный вызов не дублирует урок в completedItems', async () => {
        const { program, lesson1 } = await createProgramWithItems({ sequential: true });
        const user = await createUserInProgram(program._id);

        await api
            .post(`/api/v1/study/programs/${program._id}/lessons/${lesson1._id}/complete`)
            .set('Cookie', authCookie(user._id, user.email))
            .send({ quizAnswers: [] });

        await api
            .post(`/api/v1/study/programs/${program._id}/lessons/${lesson1._id}/complete`)
            .set('Cookie', authCookie(user._id, user.email))
            .send({ quizAnswers: [] });

        const progress = await StudyProgress.findOne({ user: user._id, program: program._id });
        const count = progress.completedItems.filter(id => id.equals(lesson1._id)).length;
        expect(count).toBe(1);
    });
});
