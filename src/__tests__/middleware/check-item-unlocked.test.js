import request from 'supertest';
import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUserInProgram } from '../../__fixtures__/user.fixture.js';
import { createProgramWithItems } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import StudyProgress from '../../models/study/progress.model.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

describe('checkItemUnlocked middleware', () => {
    describe('sequential = false', () => {
        it('все уроки доступны без прогресса', async () => {
            const { program, lesson2 } = await createProgramWithItems({ sequential: false });
            const user = await createUserInProgram(program._id);

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/lessons/${lesson2._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).not.toBe(403);
        });

        it('агенты доступны без прогресса', async () => {
            const { program, agent } = await createProgramWithItems({ sequential: false });
            const user = await createUserInProgram(program._id);

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/agents/${agent._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).not.toBe(403);
        });
    });

    describe('sequential = true', () => {
        it('первый урок доступен без прогресса', async () => {
            const { program, lesson1 } = await createProgramWithItems({ sequential: true });
            const user = await createUserInProgram(program._id);

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/lessons/${lesson1._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).not.toBe(403);
        });

        it('второй урок недоступен если первый не пройден', async () => {
            const { program, lesson2 } = await createProgramWithItems({ sequential: true });
            const user = await createUserInProgram(program._id);

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/lessons/${lesson2._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).toBe(403);
        });

        it('агент недоступен если предыдущий урок не пройден', async () => {
            const { program, agent } = await createProgramWithItems({ sequential: true });
            const user = await createUserInProgram(program._id);

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/agents/${agent._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).toBe(403);
        });

        it('агент доступен если предыдущий урок пройден', async () => {
            const { program, lesson1, agent } = await createProgramWithItems({ sequential: true });
            const user = await createUserInProgram(program._id);

            await StudyProgress.create({
                user: user._id,
                program: program._id,
                completedItems: [lesson1._id]
            });

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/agents/${agent._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).not.toBe(403);
        });

        it('второй урок доступен если первый пройден', async () => {
            const { program, lesson1, lesson2 } = await createProgramWithItems({ sequential: true });
            const user = await createUserInProgram(program._id);

            await StudyProgress.create({
                user: user._id,
                program: program._id,
                completedItems: [lesson1._id]
            });

            const res = await request(app)
                .get(`/api/v1/study/programs/${program._id}/lessons/${lesson2._id}`)
                .set('Cookie', authCookie(user._id, user.email));

            expect(res.status).not.toBe(403);
        });
    });
});
