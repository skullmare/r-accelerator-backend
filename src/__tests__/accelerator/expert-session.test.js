import request from 'supertest';

// Очередь вызовов инструментов, которые «сделает» агент на ближайших ходах:
// каждый элемент — набор tool_calls для одного прохода модели. Имя обязано
// начинаться с `mock`, иначе jest не пустит переменную внутрь hoisted-фабрики.
let mockToolCalls = [];

// chatComplete обслуживает единственный оставшийся не-стриминговый вызов —
// генерацию текста документа этапа.
jest.mock('../../services/llm.service.js', () => ({
    chatComplete: jest.fn(async () => ({
        content: [
            '## Рынок',
            '',
            'Рынок логистики растёт, основной спрос — у малого бизнеса.',
            '',
            '- Конкурент «Альфа»',
            '- Конкурент «Бета»'
        ].join('\n'),
        tokenUsage: { totalTokens: 120 }
    })),
    // Модель либо вызывает инструмент, либо пишет текст — как настоящая. Вызов
    // возможен только когда провайдеру это разрешено (toolChoice !== 'none'),
    // поэтому мок заодно проверяет, что финальный проход хода действительно
    // закрыт для инструментов.
    chatCompleteStream: jest.fn(async ({ onDelta, toolChoice }) => {
        const pending = toolChoice === 'none' ? null : mockToolCalls.shift();
        if (pending?.length) {
            return { content: '', tokenUsage: null, toolCalls: pending };
        }

        const text = 'Ответ агента пользователю';
        onDelta?.(text);
        return { content: text, tokenUsage: null, toolCalls: [] };
    })
}));

jest.mock('../../services/qdrant.service.js', () => ({
    searchContext: jest.fn().mockResolvedValue([]),
    searchKnowledge: jest.fn().mockResolvedValue([]),
    upsertChunks: jest.fn().mockResolvedValue(['point-1']),
    deleteBySource: jest.fn().mockResolvedValue(undefined)
}));

// S3 мокается, а вот рендер PDF — нет: pdfmake работает офлайн на локальных
// шрифтах, поэтому сквозной тест проверяет реальную генерацию файла.
jest.mock('../../services/s3.service.js', () => ({
    uploadFile: jest.fn(async ({ buffer }) => ({
        key: 'artifact-test.pdf',
        url: 'https://s3.test/artifact-test.pdf',
        size: buffer.length
    }))
}));

import app from '../../app.js';
import { connect, closeDatabase, clearDatabase } from '../setup.js';
import { createUser } from '../../__fixtures__/user.fixture.js';
import { authCookie } from '../../__fixtures__/auth.fixture.js';
import Project from '../../models/accelerator/project.model.js';
import Agent from '../../models/accelerator/agent.model.js';
import Artifact from '../../models/accelerator/artifact.model.js';
import ExpertSession from '../../models/accelerator/expert-session.model.js';
import { upsertChunks } from '../../services/qdrant.service.js';
import { chatComplete, chatCompleteStream } from '../../services/llm.service.js';
import { uploadFile } from '../../services/s3.service.js';

beforeAll(() => connect());
afterAll(() => closeDatabase());
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
    mockToolCalls = [];
});

const USER_ANSWER = 'рынок логистики растёт, ниша — B2B SaaS, конкуренты Альфа и Бета';

const COLLECTED_ITEMS = [
    { key: 'market', value: 'Рынок логистики растёт' },
    { key: 'niche', value: 'B2B SaaS для логистики' },
    { key: 'competitors', value: 'Альфа и Бета' }
];

function saveDataCall(items) {
    return [{
        id: 'call-save',
        type: 'function',
        function: { name: 'save_data', arguments: JSON.stringify({ items }) }
    }];
}

function stageReadyCall() {
    return [{
        id: 'call-ready',
        type: 'function',
        function: { name: 'stage_ready', arguments: '{}' }
    }];
}

// Один ход диалога, в котором агент сохраняет данные и объявляет этап
// собранным (оба вызова в одном проходе — так же, как это делает реальная
// модель).
async function collectAndMarkReady(project, cookie, sessionId, items = COLLECTED_ITEMS) {
    mockToolCalls.push([...saveDataCall(items), ...stageReadyCall()]);
    return request(app)
        .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
        .set('Cookie', cookie)
        .send({ content: USER_ANSWER });
}

// SSE-ответ приходит сырыми блоками "event: X\ndata: {...}\n\n".
function parseSSE(text) {
    return text
        .split('\n\n')
        .filter((block) => block.trim().length > 0)
        .map((block) => {
            const event = block.match(/^event: (.+)$/m)?.[1];
            const data = block.match(/^data: (.+)$/m)?.[1];
            return { event, data: data ? JSON.parse(data) : null };
        });
}

// Маршрут строится по order — связывать агентов через nextAgentId не нужно.
async function seedAgents() {
    const r1 = await Agent.create({
        name: 'Роман',
        description: 'Эксперт по рынку',
        order: 1,
        systemPrompt: 'Ты эксперт по рынку.',
        completionPrompt: 'Этап завершён, когда понятны рынок, ниша и конкуренты.'
    });
    const r2 = await Agent.create({
        name: 'Регина',
        description: 'Эксперт по аудитории',
        order: 2,
        systemPrompt: 'Ты эксперт по аудитории.',
        completionPrompt: 'Этап завершён, когда описаны сегменты аудитории.'
    });
    return { r1, r2 };
}

async function setupProject() {
    const owner = await createUser();
    const project = await Project.create({ ownerId: owner._id, name: 'Стартап' });
    return { owner, project };
}

async function openSession(project, cookie, agentId = undefined) {
    const res = await request(app)
        .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
        .set('Cookie', cookie)
        .send(agentId ? { agentId: String(agentId) } : {});
    return res;
}

describe('Сквозной маршрут: проект -> диалог -> документ -> следующий агент', () => {
    it('проводит пользователя от первого агента до последнего', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        // 1. Сессия открывается без указания агента — сервер сам берёт текущего.
        const sessionRes = await openSession(project, cookie);
        expect(sessionRes.status).toBe(201);
        expect(sessionRes.body.data.agent._id).toBe(String(r1._id));
        // Промпты обычному пользователю не отдаются.
        expect(sessionRes.body.data.agent.systemPrompt).toBeUndefined();
        const sessionId = sessionRes.body.data.session._id;

        // 2. Ход диалога: агент собирает данные и объявляет этап готовым.
        const messageRes = await collectAndMarkReady(project, cookie, sessionId);
        expect(messageRes.status).toBe(200);
        expect(messageRes.headers['content-type']).toMatch(/text\/event-stream/);

        const events = parseSSE(messageRes.text);
        const createdEvent = events.find((e) => e.event === 'message_created');
        const deltaEvents = events.filter((e) => e.event === 'delta');
        const dataEvent = events.find((e) => e.event === 'data_updated');
        const doneEvent = events.find((e) => e.event === 'done');

        expect(createdEvent.data.userMessage.content).toBe(USER_ANSWER);
        expect(deltaEvents.map((e) => e.data.text).join('')).toBe('Ответ агента пользователю');
        expect(doneEvent.data.assistantMessage.content).toBe('Ответ агента пользователю');

        // Данные приезжают на фронт ещё до конца стрима.
        expect(dataEvent.data.collectedData.competitors).toBe('Альфа и Бета');
        expect(dataEvent.data.readyForArtifact).toBe(true);
        expect(doneEvent.data.readyForArtifact).toBe(true);

        // В системный промпт уходит условие завершения и живая карточка данных.
        const [streamCall] = chatCompleteStream.mock.calls[0];
        expect(streamCall.messages[0].role).toBe('system');
        expect(streamCall.messages[0].content).toContain('Ты эксперт по рынку.');
        expect(streamCall.messages[0].content).toContain('Этап завершён, когда понятны рынок');
        expect(streamCall.messages[0].content).toContain('пока ничего не собрано');

        // 3. Завершение этапа — один вызов.
        const completeRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);
        expect(completeRes.status).toBe(200);
        expect(completeRes.body.data.nextAgentId).toBe(String(r2._id));

        // Документ этапа — реально отрендеренный PDF в хранилище.
        const artifact = completeRes.body.data.artifact;
        expect(artifact.file.url).toBe('https://s3.test/artifact-test.pdf');
        expect(artifact.file.mimeType).toBe('application/pdf');
        expect(artifact.documentMarkdown).toContain('## Рынок');
        // Сводка собрана из данных этапа, а не отдельным вызовом модели.
        expect(artifact.summary).toContain('Рынок логистики растёт');

        const [[uploadArg]] = uploadFile.mock.calls;
        expect(uploadArg.mimetype).toBe('application/pdf');
        expect(uploadArg.buffer.subarray(0, 5).toString()).toBe('%PDF-');

        // Документ этапа ушёл в индекс связным текстом.
        expect(upsertChunks).toHaveBeenCalledWith(expect.objectContaining({
            projectId: project._id,
            agentId: String(r1._id),
            sourceType: 'artifact'
        }));
        const [[indexArg]] = upsertChunks.mock.calls;
        expect(indexArg.chunks[0].text).toContain('Рынок логистики растёт');

        const projectAfterR1 = await Project.findById(project._id);
        expect(String(projectAfterR1.currentAgentId)).toBe(String(r2._id));
        expect(projectAfterR1.completedAgentIds.map(String)).toContain(String(r1._id));
        expect(projectAfterR1.contextSummary).toContain('Рынок логистики растёт');
        expect(projectAfterR1.status).toBe('active');

        // 4. Маршрут показывает пройденный и текущий этапы.
        const routeRes = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-route`)
            .set('Cookie', cookie);
        expect(routeRes.status).toBe(200);
        expect(routeRes.body.data.currentAgentId).toBe(String(r2._id));
        expect(routeRes.body.data.items.map((i) => [i.name, i.status])).toEqual([
            ['Роман', 'completed'],
            ['Регина', 'current']
        ]);

        // 5. Последний агент — и проект закрывается.
        const r2SessionRes = await openSession(project, cookie);
        expect(r2SessionRes.body.data.agent._id).toBe(String(r2._id));
        const r2SessionId = r2SessionRes.body.data.session._id;
        await collectAndMarkReady(project, cookie, r2SessionId, [{ key: 'segments', value: 'Малый бизнес' }]);

        const r2CompleteRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${r2SessionId}/complete`)
            .set('Cookie', cookie);
        expect(r2CompleteRes.status).toBe(200);
        expect(r2CompleteRes.body.data.nextAgentId).toBeNull();

        const finished = await Project.findById(project._id);
        expect(finished.status).toBe('completed');
        expect(finished.currentAgentId).toBeNull();

        // Пройденный маршрут не воскресает при повторном просмотре.
        const finalRouteRes = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-route`)
            .set('Cookie', cookie);
        expect(finalRouteRes.body.data.currentAgentId).toBeNull();
        expect(finalRouteRes.body.data.items.map((i) => i.status)).toEqual(['completed', 'completed']);
    });

    it('повторный вызов открытия сессии возвращает ту же активную сессию', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const first = await openSession(project, cookie);
        const second = await openSession(project, cookie);

        expect(second.body.data.session._id).toBe(first.body.data.session._id);
        expect(await ExpertSession.countDocuments({ projectId: project._id })).toBe(1);
    });

    it('нельзя открыть сессию с агентом, который не является текущим', async () => {
        const { r2 } = await seedAgents();
        const { owner, project } = await setupProject();

        const res = await openSession(project, authCookie(owner._id, owner.email), r2._id);

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('AGENT_NOT_CURRENT');
    });

    it('удаление текущего агента не запирает проект: маршрут продолжается со следующего непройденного', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        // Проект встал на первого агента, и админ его удалил.
        await openSession(project, cookie);
        await Agent.deleteOne({ _id: r1._id });

        const res = await openSession(project, cookie);

        expect(res.status).toBe(201);
        expect(res.body.data.agent._id).toBe(String(r2._id));
    });

    it('без заведённых агентов сессия не создаётся (409 NO_CURRENT_AGENT)', async () => {
        const { owner, project } = await setupProject();

        const res = await openSession(project, authCookie(owner._id, owner.email));

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('NO_CURRENT_AGENT');
    });

    it('чужой пользователь не может создать сессию в проекте (403)', async () => {
        await seedAgents();
        const { project } = await setupProject();
        const stranger = await createUser();

        const res = await openSession(project, authCookie(stranger._id, stranger.email));

        expect(res.status).toBe(403);
    });

    it('в завершённую сессию нельзя написать: 409 JSON-ошибкой, а не SSE', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await openSession(project, cookie);
        const sessionId = sessionRes.body.data.session._id;
        await collectAndMarkReady(project, cookie, sessionId);
        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Ещё вопрос' });

        expect(res.status).toBe(409);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
    });
});

describe('Сбор данных этапа', () => {
    it('сохраняет произвольные ключи и показывает их агенту на следующем ходу', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;

        mockToolCalls.push(saveDataCall([{ key: 'market', value: 'Рынок логистики растёт' }]));
        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: USER_ANSWER });

        const session = await ExpertSession.findById(sessionId);
        expect(session.collectedData.get('market')).toBe('Рынок логистики растёт');
        // Пока агент не вызвал stage_ready — кнопки завершения на фронте нет.
        expect(session.readyForArtifact).toBe(false);

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Что дальше?' });

        const lastStreamCall = chatCompleteStream.mock.calls.at(-1)[0];
        expect(lastStreamCall.messages[0].content).toContain('- market: Рынок логистики растёт');
        expect(lastStreamCall.messages[0].content).toContain('не прощайся');
    });

    it('второй вызов инструмента за ход невозможен: финальный проход идёт с tool_choice=none', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;

        mockToolCalls.push(saveDataCall([COLLECTED_ITEMS[0]]));
        mockToolCalls.push(saveDataCall([COLLECTED_ITEMS[1]]));

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: USER_ANSWER });

        expect(chatCompleteStream).toHaveBeenCalledTimes(2);
        expect(chatCompleteStream.mock.calls[0][0].toolChoice).toBe('auto');
        expect(chatCompleteStream.mock.calls[1][0].toolChoice).toBe('none');

        const session = await ExpertSession.findById(sessionId);
        expect([...session.collectedData.keys()]).toEqual(['market']);
    });
});

describe('Надёжность завершения этапа', () => {
    it('завершает этап, даже если агент не успел объявить его готовым', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;

        mockToolCalls.push(saveDataCall([COLLECTED_ITEMS[0]]));
        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: USER_ANSWER });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data.nextAgentId).toBe(String(r2._id));

        const after = await Project.findById(project._id);
        expect(after.completedAgentIds.map(String)).toContain(String(r1._id));
    });

    it('повторное завершение идемпотентно: тот же документ, без новой генерации', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;
        await collectAndMarkReady(project, cookie, sessionId);

        const first = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);
        const second = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        expect(second.status).toBe(200);
        expect(second.body.data.artifact._id).toBe(first.body.data.artifact._id);
        expect(chatComplete).toHaveBeenCalledTimes(1);
        expect(await Artifact.countDocuments({ projectId: project._id })).toBe(1);
    });

    it('сбой индексации в Qdrant не мешает пройти этап', async () => {
        const { r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;
        await collectAndMarkReady(project, cookie, sessionId);

        upsertChunks.mockRejectedValueOnce(new Error('Qdrant недоступен'));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data.nextAgentId).toBe(String(r2._id));
        // Итоги этапа всё равно дошли до следующего агента — через сводку проекта.
        const after = await Project.findById(project._id);
        expect(after.contextSummary).toContain('Рынок логистики растёт');
    });

    it('«висячий» nextAgentId не рвёт маршрут — переход идёт по order', async () => {
        const { r1, r2 } = await seedAgents();
        // Админ связал агентов вручную и удалил указанного следующего.
        await Agent.findByIdAndUpdate(r1._id, { nextAgentId: '507f1f77bcf86cd799439099' });
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;
        await collectAndMarkReady(project, cookie, sessionId);

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data.nextAgentId).toBe(String(r2._id));
    });

    it('nextAgentId переопределяет порядок: маршрут может быть нелинейным', async () => {
        const { r1, r2 } = await seedAgents();
        const r3 = await Agent.create({
            name: 'Тимур',
            order: 3,
            systemPrompt: 'Ты эксперт по финансам.',
            completionPrompt: 'Этап завершён, когда есть финмодель.'
        });
        await Agent.findByIdAndUpdate(r1._id, { nextAgentId: r3._id });
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;
        await collectAndMarkReady(project, cookie, sessionId);

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        expect(res.body.data.nextAgentId).toBe(String(r3._id));
        expect(res.body.data.nextAgentId).not.toBe(String(r2._id));
    });

    it('сбой генерации документа отдаёт 502 и не двигает маршрут', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;
        await collectAndMarkReady(project, cookie, sessionId);

        chatComplete.mockRejectedValueOnce(new Error('OpenAI API недоступен'));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie);

        expect(res.status).toBe(502);
        expect(res.body.error.code).toBe('LLM_PROVIDER_FAILED');
        expect(await Artifact.countDocuments({ projectId: project._id })).toBe(0);

        const after = await Project.findById(project._id);
        expect(String(after.currentAgentId)).toBe(String(r1._id));
    });

    it('SSE-событие error нормализует код до LLM_PROVIDER_FAILED', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;

        chatCompleteStream.mockRejectedValueOnce(new Error('Соединение с OpenAI оборвалось'));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Привет' });

        expect(res.status).toBe(200);
        const errorEvent = parseSSE(res.text).find((e) => e.event === 'error');
        expect(errorEvent.data.code).toBe('LLM_PROVIDER_FAILED');
    });
});

describe('GET /accelerator/projects/:projectId/expert-sessions/:sessionId/messages', () => {
    it('возвращает историю и состояние этапа одним запросом', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = (await openSession(project, cookie)).body.data.session._id;

        await collectAndMarkReady(project, cookie, sessionId);

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(2);
        expect(res.body.data.items[0].senderType).toBe('user');
        expect(res.body.data.items[1].senderType).toBe('assistant');
        expect(res.body.data.collectedData.market).toBe('Рынок логистики растёт');
        expect(res.body.data.readyForArtifact).toBe(true);
        expect(res.body.data.status).toBe('active');
    });

    it('чужой пользователь не может прочитать историю сообщений (403)', async () => {
        await seedAgents();
        const { owner, project } = await setupProject();
        const stranger = await createUser();
        const sessionId = (await openSession(project, authCookie(owner._id, owner.email))).body.data.session._id;

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', authCookie(stranger._id, stranger.email));

        expect(res.status).toBe(403);
    });

    it('возвращает 404 для несуществующей сессии', async () => {
        const { owner, project } = await setupProject();

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-sessions/507f1f77bcf86cd799439099/messages`)
            .set('Cookie', authCookie(owner._id, owner.email));

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('возвращает 401 без авторизации', async () => {
        const { project } = await setupProject();

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-sessions/507f1f77bcf86cd799439099/messages`);

        expect(res.status).toBe(401);
    });
});

describe('GET /accelerator/projects/:projectId/artifacts', () => {
    async function createArtifact(project, agentId, summary) {
        return Artifact.create({
            projectId: project._id,
            expertSessionId: '507f1f77bcf86cd799439011',
            agentId,
            title: 'Документ этапа',
            documentMarkdown: '## Раздел',
            summary
        });
    }

    it('возвращает документы проекта в порядке создания', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();

        const first = await createArtifact(project, r1._id, 'Сводка рынка');
        const second = await createArtifact(project, r2._id, 'Сводка аудитории');

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/artifacts`)
            .set('Cookie', authCookie(owner._id, owner.email));

        expect(res.status).toBe(200);
        expect(res.body.data.items.map((a) => a._id)).toEqual([String(first._id), String(second._id)]);
    });

    it('не включает документы чужих проектов', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const { project: otherProject } = await setupProject();
        await createArtifact(otherProject, r1._id, 'Чужая сводка');

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/artifacts`)
            .set('Cookie', authCookie(owner._id, owner.email));

        expect(res.status).toBe(200);
        expect(res.body.data.items).toEqual([]);
    });

    it('возвращает 403 не владельцу проекта', async () => {
        const { project } = await setupProject();
        const stranger = await createUser();

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/artifacts`)
            .set('Cookie', authCookie(stranger._id, stranger.email));

        expect(res.status).toBe(403);
    });

    it('возвращает 401 без авторизации', async () => {
        const { project } = await setupProject();

        const res = await request(app).get(`/api/v1/accelerator/projects/${project._id}/artifacts`);

        expect(res.status).toBe(401);
    });
});
