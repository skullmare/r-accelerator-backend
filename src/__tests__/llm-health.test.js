import request from 'supertest';
import { APIConnectionError, APIError } from 'openai';

// Клиенты провайдеров мокаются на уровне конфигов — так тест бьёт по тому же
// коду, что и прод (llm-health.service импортирует именно их), не подменяя
// саму проверяемую логику.
const mockChatCreate = jest.fn();
const mockEmbeddingsCreate = jest.fn();

jest.mock('../../config/openai.config.js', () => ({
    __esModule: true,
    default: { chat: { completions: { create: (...args) => mockChatCreate(...args) } } }
}));

jest.mock('../../config/openrouter.config.js', () => ({
    __esModule: true,
    default: {
        baseURL: 'https://openrouter.test/api/v1',
        embeddings: { create: (...args) => mockEmbeddingsCreate(...args) }
    }
}));

import app from '../app.js';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { createUser } from '../__fixtures__/user.fixture.js';
import { authCookie } from '../__fixtures__/auth.fixture.js';
import Role from '../models/role.model.js';
import { resetLlmHealthCache } from '../services/llm-health.service.js';

const URL = '/api/v1/system/llm-health';

// Форма как в проде: SDK передаёт в APIError ВНУТРЕННИЙ объект ошибки
// ({ message, code, type }), а не тело целиком — иначе error.code не заполнится
// и insufficient_quota было бы не отличить от обычного 429. Headers обязан быть
// настоящим: конструктор SDK дёргает у него .get().
function apiError(status, message, code) {
    return new APIError(status, { message, code }, message, new Headers());
}

beforeAll(() => connect());
afterAll(() => closeDatabase());

beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENROUTER_API_KEY = 'sk-or-test';

    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: 'p' } }] });
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: new Array(3072).fill(0) }] });

    // /key и /credits дёргаются сырым fetch — в SDK этих эндпоинтов нет.
    global.fetch = jest.fn(async (url) => ({
        ok: true,
        status: 200,
        json: async () => (String(url).endsWith('/credits')
            ? { data: { total_credits: 10, total_usage: 8.5 } }
            : { data: { is_free_tier: false, usage: 0.04, limit_remaining: null } })
    }));
});

afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
    // Кеш живёт 60 секунд и between-тестами дал бы ложные «зелёные» ответы.
    resetLlmHealthCache();
});

async function diagnosticsUser() {
    const role = await Role.create({ name: 'diag', permissions: ['system_diagnostics.read'] });
    return createUser({ role: role._id });
}

async function getHealth(user, query = '') {
    return request(app).get(`${URL}${query}`).set('Cookie', authCookie(user._id, user.email));
}

describe('GET /api/v1/system/llm-health — доступ', () => {
    it('возвращает 401 без авторизации', async () => {
        const res = await request(app).get(URL);
        expect(res.status).toBe(401);
    });

    it('возвращает 403 пользователю без права system_diagnostics.read', async () => {
        const user = await createUser();
        const res = await getHealth(user);
        expect(res.status).toBe(403);
    });

    it('пускает пользователя с правом system_diagnostics.read', async () => {
        const res = await getHealth(await diagnosticsUser());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/v1/system/llm-health — диагностика', () => {
    it('всё работает: status=ok, баланс посчитан как total_credits - total_usage', async () => {
        const res = await getHealth(await diagnosticsUser());

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('ok');
        expect(res.body.data.checks.chat.status).toBe('ok');
        expect(res.body.data.checks.embeddings.status).toBe('ok');

        const account = res.body.data.checks.openrouterAccount;
        expect(account.status).toBe('ok');
        expect(account.balanceUsd).toBe(1.5);
        expect(account.isFreeTier).toBe(false);
        // limit_remaining=null — на ключе нет лимита. Это НЕ баланс аккаунта,
        // и путать их нельзя: пустой лимит не означает пустой счёт.
        expect(account.keyLimitRemainingUsd).toBeNull();
    });

    it('нет сети до провайдера: unreachable, а не invalid_key — именно так выглядела боевая авария', async () => {
        mockChatCreate.mockRejectedValue(new APIConnectionError({ message: 'Connection error.' }));

        const res = await getHealth(await diagnosticsUser());

        expect(res.body.data.status).toBe('down');
        expect(res.body.data.checks.chat.status).toBe('unreachable');
        expect(res.body.data.checks.chat.message).toMatch(/нет доступа|Соединение/);
    });

    it('битый ключ отличается от кончившихся денег', async () => {
        mockChatCreate.mockRejectedValue(apiError(401, 'invalid api key'));
        mockEmbeddingsCreate.mockRejectedValue(apiError(402, 'no credits'));

        const res = await getHealth(await diagnosticsUser());

        expect(res.body.data.checks.chat.status).toBe('invalid_key');
        expect(res.body.data.checks.embeddings.status).toBe('no_credits');
        expect(res.body.data.status).toBe('down');
    });

    it('OpenAI сообщает о кончившихся деньгах через 429 + insufficient_quota, а не 402', async () => {
        mockChatCreate.mockRejectedValue(apiError(429, 'quota exceeded', 'insufficient_quota'));

        const res = await getHealth(await diagnosticsUser());

        // Именно поэтому код проверяется раньше статуса: по одному 429 это
        // выглядело бы как временный rate limit.
        expect(res.body.data.checks.chat.status).toBe('no_credits');
        expect(res.body.data.status).toBe('down');
    });

    it('rate limit — это degraded, а не down: деньги есть и само пройдёт', async () => {
        mockChatCreate.mockRejectedValue(apiError(429, 'slow down'));

        const res = await getHealth(await diagnosticsUser());

        expect(res.body.data.checks.chat.status).toBe('rate_limited');
        expect(res.body.data.status).toBe('degraded');
    });

    it('размерность эмбеддингов разъехалась с EMBEDDING_DIM -> misconfigured', async () => {
        mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0) }] });

        const res = await getHealth(await diagnosticsUser());

        const embeddings = res.body.data.checks.embeddings;
        expect(embeddings.status).toBe('misconfigured');
        expect(embeddings.dimensions).toBe(1536);
        expect(embeddings.expectedDimensions).toBe(3072);
        expect(embeddings.message).toMatch(/Qdrant/);
        expect(res.body.data.status).toBe('down');
    });

    it('исчерпанный баланс OpenRouter ловится по цифрам, даже если ключ ещё валиден', async () => {
        global.fetch = jest.fn(async (url) => ({
            ok: true,
            status: 200,
            json: async () => (String(url).endsWith('/credits')
                ? { data: { total_credits: 10, total_usage: 10 } }
                : { data: { is_free_tier: false, usage: 10, limit_remaining: null } })
        }));

        const res = await getHealth(await diagnosticsUser());

        expect(res.body.data.checks.openrouterAccount.status).toBe('no_credits');
        expect(res.body.data.checks.openrouterAccount.balanceUsd).toBe(0);
    });

    it('недоступный /credits не объявляет провайдера сломанным — баланс просто null', async () => {
        global.fetch = jest.fn(async (url) => (String(url).endsWith('/credits')
            ? { ok: false, status: 403, text: async () => 'forbidden' }
            : { ok: true, status: 200, json: async () => ({ data: { is_free_tier: false, usage: 0.04, limit_remaining: null } }) }));

        const res = await getHealth(await diagnosticsUser());

        expect(res.body.data.checks.openrouterAccount.status).toBe('ok');
        expect(res.body.data.checks.openrouterAccount.balanceUsd).toBeNull();
        expect(res.body.data.status).toBe('ok');
    });

    it('незаданный ключ — not_configured, без обращения к сети', async () => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENROUTER_API_KEY;

        const res = await getHealth(await diagnosticsUser());

        expect(res.body.data.checks.chat.status).toBe('not_configured');
        expect(res.body.data.checks.embeddings.status).toBe('not_configured');
        expect(mockChatCreate).not.toHaveBeenCalled();
        expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });
});

describe('GET /api/v1/system/llm-health — кеш', () => {
    it('повторный запрос отдаётся из кеша и не дёргает провайдеров', async () => {
        const user = await diagnosticsUser();

        const first = await getHealth(user);
        expect(first.body.data.cached).toBe(false);
        expect(mockChatCreate).toHaveBeenCalledTimes(1);

        const second = await getHealth(user);
        expect(second.body.data.cached).toBe(true);
        // Ключевое: открытая админка не должна тратить деньги на каждый рендер.
        expect(mockChatCreate).toHaveBeenCalledTimes(1);
    });

    it('?refresh=true перепроверяет провайдеров заново', async () => {
        const user = await diagnosticsUser();

        await getHealth(user);
        const refreshed = await getHealth(user, '?refresh=true');

        expect(refreshed.body.data.cached).toBe(false);
        expect(mockChatCreate).toHaveBeenCalledTimes(2);
    });
});
