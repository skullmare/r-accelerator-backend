import api from '../helpers/api.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser, createUserInProgram } from '../../__fixtures__/user.fixture.js';
import { createProgram } from '../../__fixtures__/program.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(() => clearDatabase());

describe('checkAccessProgram middleware', () => {
    it('возвращает 403 если пользователь не в программе', async () => {
        const program = await createProgram();
        const user = await createUser();

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`)
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });

    it('пропускает если пользователь состоит в программе', async () => {
        const program = await createProgram();
        const user = await createUserInProgram(program._id);

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`)
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).not.toBe(403);
    });

    it('возвращает 403 если программа неактивна', async () => {
        const program = await createProgram({ active: false });
        const user = await createUserInProgram(program._id);

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`)
            .set('Cookie', authCookie(user._id, user.email));

        expect(res.status).toBe(403);
    });

    it('возвращает 401 без токена', async () => {
        const program = await createProgram();

        const res = await api
            .get(`/api/v1/study/programs/${program._id}/progress`);

        expect(res.status).toBe(401);
    });
});
