import request from 'supertest';

// Очередь вызовов инструмента, которые «сделает» агент на ближайших ходах:
// каждый элемент — набор tool_calls для одного прохода модели. Имя обязано
// начинаться с `mock`, иначе jest не пустит переменную внутрь hoisted-фабрики
// ниже.
let mockToolCalls = [];

// chatComplete обслуживает генерацию артефакта (структурированные поля -> текст
// документа) и разовый бэкфилл карточки этапа. Мок различает вызовы по
// инструкции в последнем сообщении — ровно как это делает реальный поток.
jest.mock('../../services/llm.service.js', () => ({
    chatComplete: jest.fn(async ({ messages }) => {
        const instruction = messages[messages.length - 1].content;

        if (instruction.includes('Перенеси в карточку этапа')) {
            return { content: JSON.stringify({ fields: [] }), tokenUsage: null };
        }

        if (instruction.includes('Напиши финальный документ')) {
            return {
                content: [
                    '## Рынок',
                    '',
                    'Рынок растёт, основной спрос — у малого бизнеса.',
                    '',
                    '- Конкурент «Альфа»',
                    '- Конкурент «Бета»',
                    '',
                    '| Конкурент | Доля |',
                    '|---|---|',
                    '| Альфа | 35% |'
                ].join('\n'),
                tokenUsage: { totalTokens: 120 }
            };
        }

        return {
            content: JSON.stringify({
                marketDescription: 'Описание рынка',
                nicheHypothesis: 'Гипотеза ниши',
                competitors: 'Конкуренты',
                risks: 'Риски',
                summary: 'Итоговая сводка по рынку'
            }),
            tokenUsage: { totalTokens: 42 }
        };
    }),
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

// Реплика пользователя, из которой агент «достаёт» все поля карточки R1.
// Цитаты в R1_FIELD_UPDATES обязаны дословно встречаться именно здесь — иначе
// проверка происхождения отклонит сохранение, как и на проде.
const R1_USER_ANSWER = 'рынок логистики растёт, ниша — B2B SaaS, ' +
    'конкуренты Альфа и Бета, риски — длинный цикл продаж';

const R1_FIELD_UPDATES = [
    { name: 'marketDescription', value: 'Рынок логистики растёт', quote: 'рынок логистики растёт' },
    { name: 'nicheHypothesis', value: 'B2B SaaS для логистики', quote: 'ниша — B2B SaaS' },
    { name: 'competitors', value: 'Альфа и Бета', quote: 'конкуренты Альфа и Бета' },
    { name: 'risks', value: 'Длинный цикл продаж', quote: 'риски — длинный цикл продаж' }
];

function saveFieldsCall(fields) {
    return [{
        id: 'call-1',
        type: 'function',
        function: { name: 'save_collected_fields', arguments: JSON.stringify({ fields }) }
    }];
}

// Один ход диалога, в котором агент складывает данные в карточку этапа. После
// него completionState.ready=true, и этап проходит гейт завершения.
async function collectStageFields(project, cookie, sessionId, fields = R1_FIELD_UPDATES) {
    mockToolCalls.push(saveFieldsCall(fields));
    return request(app)
        .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
        .set('Cookie', cookie)
        .send({ content: R1_USER_ANSWER });
}

// SSE responses come back as raw "event: X\ndata: {...}\n\n" blocks.
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

async function seedAgents() {
    const r2 = await Agent.create({
        name: 'Регина',
        roleTitle: 'Эксперт по аудитории',
        order: 2,
        nextAgentId: null,
        systemPrompt: 'Ты эксперт по аудитории.',
        completionCriteria: 'Собран бриф аудитории.',
        artifactDefinition: {
            artifactType: 'audience_brief',
            requiredFields: ['summary']
        }
    });
    const r1 = await Agent.create({
        name: 'Роман',
        roleTitle: 'Эксперт по рынку',
        order: 1,
        nextAgentId: r2._id,
        systemPrompt: 'Ты эксперт по рынку.',
        completionCriteria: 'Собран рыночный бриф.',
        artifactDefinition: {
            artifactType: 'market_brief',
            requiredFields: ['marketDescription', 'nicheHypothesis', 'competitors', 'risks', 'summary']
        }
    });
    return { r1, r2 };
}

async function setupProject() {
    const owner = await createUser();
    const project = await Project.create({ ownerId: owner._id, name: 'Стартап' });
    return { owner, project };
}

describe('Экспертный маршрут R1 -> R2 (сквозной сценарий)', () => {
    it('проходит create session -> message (SSE) -> draft complete -> confirm complete -> R2', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        expect(sessionRes.status).toBe(201);
        const sessionId = sessionRes.body.data.session._id;

        const messageRes = await collectStageFields(project, cookie, sessionId);
        expect(messageRes.status).toBe(200);
        expect(messageRes.headers['content-type']).toMatch(/text\/event-stream/);

        const events = parseSSE(messageRes.text);
        const createdEvent = events.find((e) => e.event === 'message_created');
        const deltaEvents = events.filter((e) => e.event === 'delta');
        const fieldsEvent = events.find((e) => e.event === 'fields_updated');
        const doneEvent = events.find((e) => e.event === 'done');

        expect(createdEvent.data.userMessage.content).toBe(R1_USER_ANSWER);
        expect(deltaEvents.length).toBeGreaterThan(0);
        expect(deltaEvents.map((e) => e.data.text).join('')).toBe('Ответ агента пользователю');
        expect(doneEvent.data.assistantMessage.content).toBe('Ответ агента пользователю');

        // Агент сложил данные в карточку этапа прямо посреди хода — фронт
        // узнаёт об этом отдельным событием, не дожидаясь конца стрима.
        expect(fieldsEvent.data.collectedFields.competitors.value).toBe('Альфа и Бета');
        expect(fieldsEvent.data.completionState.ready).toBe(true);

        // Готовность этапа приходит вместе с ответом — по ней фронт решает,
        // показывать ли кнопку формирования артефакта. Это уже не вердикт
        // отдельной модели, а арифметика по заполненным полям карточки.
        expect(doneEvent.data.completionState.ready).toBe(true);
        expect(doneEvent.data.completionState.missingFields).toEqual([]);

        // В системный промпт уходит живой чек-лист заполненности, собранный из
        // базы: на первом ходу пусто, поэтому агент видит все поля как
        // несобранные и знает, что спрашивать.
        const [streamCall] = chatCompleteStream.mock.calls[0];
        expect(streamCall.messages[0].role).toBe('system');
        expect(streamCall.messages[0].content).toContain('Карточка этапа — заполнено 0 из 4');
        expect(streamCall.messages[0].content).toContain('[ ] marketDescription — не собрано');
        // summary — синтез остальных полей, в диалоге он не собирается.
        expect(streamCall.messages[0].content).not.toContain('[ ] summary');

        const draftRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});
        expect(draftRes.status).toBe(200);
        expect(draftRes.body.data.artifact.status).toBe('ready');
        expect(draftRes.body.data.nextAgentId).toBeNull();

        // Артефакт этапа — сгенерированный PDF: он отрендерен по-настоящему и
        // выложен в хранилище уже на стадии черновика, до подтверждения.
        expect(draftRes.body.data.artifact.file.url).toBe('https://s3.test/artifact-test.pdf');
        expect(draftRes.body.data.artifact.file.mimeType).toBe('application/pdf');
        expect(draftRes.body.data.artifact.documentMarkdown).toContain('## Рынок');

        const [[uploadArg]] = uploadFile.mock.calls;
        expect(uploadArg.mimetype).toBe('application/pdf');
        expect(uploadArg.buffer.subarray(0, 5).toString()).toBe('%PDF-');

        const projectAfterDraft = await Project.findById(project._id);
        expect(String(projectAfterDraft.currentAgentId)).toBe(String(r1._id));

        const confirmRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.data.artifact.status).toBe('confirmed');
        expect(confirmRes.body.data.nextAgentId).toBe(String(r2._id));

        const projectAfterConfirm = await Project.findById(project._id);
        expect(String(projectAfterConfirm.currentAgentId)).toBe(String(r2._id));
        expect(projectAfterConfirm.completedAgentIds.map(String)).toContain(String(r1._id));
        expect(projectAfterConfirm.contextSummary).toContain('Итоговая сводка по рынку');

        expect(upsertChunks).toHaveBeenCalledWith(expect.objectContaining({
            projectId: project._id,
            agentId: String(r1._id),
            sourceType: 'artifact'
        }));

        // В индекс уходит связный текст документа (documentMarkdown), а не
        // JSON.stringify структурированных полей.
        const [[indexArg]] = upsertChunks.mock.calls;
        expect(indexArg.chunks[0].text).toContain('Рынок растёт');
        expect(indexArg.chunks[0].text).not.toContain('"marketDescription"');

        const routeRes = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-route`)
            .set('Cookie', cookie);
        expect(routeRes.status).toBe(200);
        expect(routeRes.body.data.currentAgentId).toBe(String(r2._id));
        expect(routeRes.body.data.items).toEqual([
            { _id: String(r1._id), name: 'Роман', status: 'completed', nextAgentId: String(r2._id) },
            { _id: String(r2._id), name: 'Регина', status: 'current', nextAgentId: null }
        ]);

        const repeatCompleteRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(repeatCompleteRes.status).toBe(409);
    });

    it('чужой пользователь не может создать сессию в проекте (403)', async () => {
        const { r1 } = await seedAgents();
        const { project } = await setupProject();
        const stranger = await createUser();

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(stranger._id, stranger.email))
            .send({ agentId: String(r1._id) });

        expect(res.status).toBe(403);
    });

    it('возвращает 404 при создании сессии с несуществующим agentId', async () => {
        const { owner, project } = await setupProject();

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ agentId: '507f1f77bcf86cd799439099' });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('возвращает 409 JSON-ошибкой (не SSE), если сессия уже завершена', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;

        // Диалог нужен: без собранной карточки гейт не пустит этап к завершению.
        await collectStageFields(project, cookie, sessionId);

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Ещё вопрос' });

        expect(res.status).toBe(409);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
    });
});

describe('Гейт готовности этапа (DONE-4)', () => {
    async function startDialogue(project, cookie, agentId, { withMessage = true, collect = true } = {}) {
        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(agentId) });
        const sessionId = sessionRes.body.data.session._id;

        if (withMessage) {
            if (collect) {
                await collectStageFields(project, cookie, sessionId);
            } else {
                await request(app)
                    .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
                    .set('Cookie', cookie)
                    .send({ content: R1_USER_ANSWER });
            }
        }

        return sessionId;
    }

    it('не даёт сформировать артефакт, пока карточка этапа заполнена не полностью', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id, { collect: false });

        // Агент собрал только два поля из четырёх.
        await collectStageFields(project, cookie, sessionId, R1_FIELD_UPDATES.slice(0, 2));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('STAGE_NOT_READY');
        expect(res.body.error.missingFields).toEqual(['competitors', 'risks']);

        // Ни артефакта, ни файла: до генерации дело не дошло.
        expect(await Artifact.countDocuments({ projectId: project._id })).toBe(0);
        expect(uploadFile).not.toHaveBeenCalled();

        // Маршрут не сдвинулся.
        const after = await Project.findById(project._id);
        expect(String(after.currentAgentId)).toBe(String(r1._id));

        // На следующем ходу агент видит ту же карточку, что и сервер: два поля
        // закрыты, два открыты. Расхождение во мнениях невозможно — источник
        // один, и это база, а не отдельная модель.
        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Что ещё нужно обсудить?' });

        const lastStreamCall = chatCompleteStream.mock.calls.at(-1)[0];
        expect(lastStreamCall.messages[0].content).toContain('Карточка этапа — заполнено 2 из 4');
        expect(lastStreamCall.messages[0].content).toContain('[x] marketDescription');
        expect(lastStreamCall.messages[0].content).toContain('[ ] competitors — не собрано');
        expect(lastStreamCall.messages[0].content).toContain('не желай удачи на следующем этапе');
    });

    it('поле с выдуманной цитатой не сохраняется, а отказ уходит агенту внутрь хода', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id, { withMessage: false });

        // Пользователь про конкурентов ничего не говорил, а агент пытается
        // закрыть поле цитатой, которой в его репликах нет.
        await collectStageFields(project, cookie, sessionId, [
            { name: 'marketDescription', value: 'Рынок логистики растёт', quote: 'рынок логистики растёт' },
            { name: 'competitors', value: 'Их нет', quote: 'конкурентов на рынке вообще не существует' }
        ]);

        const session = await ExpertSession.findById(sessionId);
        expect(session.collectedFields.get('marketDescription').value).toBe('Рынок логистики растёт');
        expect(session.collectedFields.get('competitors')).toBeUndefined();

        // Отказ ушёл в модель как результат её же вызова — пользователь его не
        // видит, а агент получает шанс исправиться в том же ходу.
        const toolResult = chatCompleteStream.mock.calls
            .at(-1)[0].messages
            .find((m) => m.role === 'tool');
        const payload = JSON.parse(toolResult.content);
        expect(payload.ok).toBe(false);
        expect(payload.saved).toEqual(['marketDescription']);
        expect(payload.rejected[0].name).toBe('competitors');
        expect(payload.rejected[0].reason).toContain('цитата не найдена');
        expect(payload.missingFields).toEqual(['nicheHypothesis', 'competitors', 'risks']);
    });

    it('второй вызов инструмента за ход невозможен: финальный проход идёт с tool_choice=none', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id, { withMessage: false });

        // Агент «хочет» звать инструмент дважды подряд — потолок раундов не даёт.
        mockToolCalls.push(saveFieldsCall(R1_FIELD_UPDATES.slice(0, 1)));
        mockToolCalls.push(saveFieldsCall(R1_FIELD_UPDATES.slice(1, 2)));

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: R1_USER_ANSWER });

        // Ровно два прохода модели: с инструментом и принудительно текстовый.
        expect(chatCompleteStream).toHaveBeenCalledTimes(2);
        expect(chatCompleteStream.mock.calls[0][0].toolChoice).toBe('auto');
        expect(chatCompleteStream.mock.calls[1][0].toolChoice).toBe('none');

        // Сохранилось только то, что успел первый раунд.
        const session = await ExpertSession.findById(sessionId);
        expect([...session.collectedFields.keys()]).toEqual(['marketDescription']);
    });

    it('этап без единого сообщения считается неготовым без вызова модели', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id, { withMessage: false });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('STAGE_NOT_READY');
        expect(chatComplete).not.toHaveBeenCalled();
    });

    it('allowPartialCompletion=true пропускает этап мимо гейта', async () => {
        const { r1 } = await seedAgents();
        await Agent.findByIdAndUpdate(r1._id, { allowPartialCompletion: true });
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        // Карточка заполнена лишь частично — обычный этап так не завершить.
        const sessionId = await startDialogue(project, cookie, r1._id, { collect: false });
        await collectStageFields(project, cookie, sessionId, R1_FIELD_UPDATES.slice(0, 1));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.data.artifact.status).toBe('ready');
    });

    it('перегенерация создаёт новый черновик, а прежний помечает rejected', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id);

        const first = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});
        expect(first.status).toBe(200);

        const second = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ regenerate: true });
        expect(second.status).toBe(200);
        expect(second.body.data.artifact._id).not.toBe(first.body.data.artifact._id);

        const previous = await Artifact.findById(first.body.data.artifact._id);
        expect(previous.status).toBe('rejected');
    });

    it('завершённый маршрут не воскресает: после финального агента currentAgentId остаётся null', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        // Проходим весь маршрут R1 -> R2 (у R2 nextAgentId=null).
        for (const agent of [r1, r2]) {
            const sessionId = await startDialogue(project, cookie, agent._id);
            const res = await request(app)
                .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
                .set('Cookie', cookie)
                .send({ confirmArtifact: true });
            expect(res.status).toBe(200);
        }

        const completed = await Project.findById(project._id);
        expect(completed.status).toBe('completed');
        expect(completed.currentAgentId).toBeNull();

        // Просмотр маршрута раньше «самолечил» currentAgentId обратно на R1 и
        // молча перезапускал пройденный маршрут.
        const routeRes = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-route`)
            .set('Cookie', cookie);
        expect(routeRes.status).toBe(200);
        expect(routeRes.body.data.currentAgentId).toBeNull();
        expect(routeRes.body.data.items.map((i) => i.status)).toEqual(['completed', 'completed']);

        const afterRoute = await Project.findById(project._id);
        expect(afterRoute.currentAgentId).toBeNull();

        // И новую сессию по пройденному маршруту создать нельзя.
        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        expect(sessionRes.status).toBe(409);
        expect(sessionRes.body.error.code).toBe('AGENT_NOT_CURRENT');
    });

    it('подтверждение с «висячим» nextAgentId отклоняется без потери артефакта', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id);

        // Черновик создаётся штатно...
        const draftRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});
        expect(draftRes.status).toBe(200);

        // ...а затем администратор удаляет следующего агента маршрута.
        await Agent.deleteOne({ _id: r2._id });

        const confirmRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        expect(confirmRes.status).toBe(409);
        expect(confirmRes.body.error.code).toBe('NEXT_AGENT_UNAVAILABLE');

        // Ничего не потеряно и не мутировано: артефакт остался черновиком,
        // сессия ждёт подтверждения, проект стоит на R1, индексации не было.
        const artifact = await Artifact.findById(draftRes.body.data.artifact._id);
        expect(artifact.status).toBe('ready');

        const after = await Project.findById(project._id);
        expect(String(after.currentAgentId)).toBe(String(r1._id));
        expect(after.completedAgentIds).toHaveLength(0);
        expect(upsertChunks).not.toHaveBeenCalled();
    });

    it('подтверждённый артефакт нельзя сгенерировать заново', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);
        const sessionId = await startDialogue(project, cookie, r1._id);

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ regenerate: true });

        // Сессия уже completed — до проверки самого артефакта дело не доходит.
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('SESSION_ALREADY_COMPLETED');
    });
});

describe('GET /accelerator/projects/:projectId/expert-sessions/:sessionId/messages', () => {
    it('возвращает историю сообщений сессии в хронологическом порядке', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;

        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Первое сообщение' });

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(2);
        expect(res.body.data.items[0].senderType).toBe('user');
        expect(res.body.data.items[0].content).toBe('Первое сообщение');
        expect(res.body.data.items[1].senderType).toBe('assistant');
        expect(res.body.data.items[1].content).toBe('Ответ агента пользователю');
    });

    it('чужой пользователь не может прочитать историю сообщений (403)', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const stranger = await createUser();

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;

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
    it('возвращает артефакты проекта в порядке создания', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();

        const sessionA = await Artifact.create({
            projectId: project._id,
            expertSessionId: '507f1f77bcf86cd799439011',
            agentId: r1._id,
            type: 'market_brief',
            title: 'Рыночный бриф',
            content: { summary: 'Сводка рынка' },
            summary: 'Сводка рынка',
            status: 'confirmed'
        });
        const sessionB = await Artifact.create({
            projectId: project._id,
            expertSessionId: '507f1f77bcf86cd799439012',
            agentId: r2._id,
            type: 'audience_brief',
            title: 'Бриф аудитории',
            content: { summary: 'Сводка аудитории' },
            summary: 'Сводка аудитории',
            status: 'ready'
        });

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/artifacts`)
            .set('Cookie', authCookie(owner._id, owner.email));

        expect(res.status).toBe(200);
        expect(res.body.data.items.map((a) => a._id)).toEqual([String(sessionA._id), String(sessionB._id)]);
        expect(res.body.data.items[0].status).toBe('confirmed');
        expect(res.body.data.items[1].status).toBe('ready');
    });

    it('не включает артефакты чужих проектов', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const { project: otherProject } = await setupProject();

        await Artifact.create({
            projectId: otherProject._id,
            expertSessionId: '507f1f77bcf86cd799439011',
            agentId: r1._id,
            type: 'market_brief',
            title: 'Рыночный бриф',
            content: { summary: 'Сводка' },
            summary: 'Сводка',
            status: 'confirmed'
        });

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

        const res = await request(app)
            .get(`/api/v1/accelerator/projects/${project._id}/artifacts`);

        expect(res.status).toBe(401);
    });
});

describe('Коды ошибок фронта: AGENT_INACTIVE / QDRANT_INDEX_FAILED / LLM_PROVIDER_FAILED', () => {
    it('POST expert-sessions возвращает 409 AGENT_INACTIVE, если агент существует, но isActive=false (не путать с AGENT_NOT_FOUND)', async () => {
        const { owner, project } = await setupProject();
        const r1 = await Agent.create({
            name: 'Роман',
            roleTitle: 'Эксперт по рынку',
            order: 1,
            isActive: false,
            systemPrompt: 'Ты эксперт по рынку.',
            completionCriteria: 'Собран рыночный бриф.',
            artifactDefinition: { artifactType: 'market_brief', requiredFields: ['summary'] }
        });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', authCookie(owner._id, owner.email))
            .send({ agentId: String(r1._id) });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('AGENT_INACTIVE');
    });

    it('POST .../complete возвращает 502 QDRANT_INDEX_FAILED (не 500/ARTIFACT_VALIDATION_FAILED), если падает запись подтверждённого артефакта в Qdrant', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;
        await collectStageFields(project, cookie, sessionId);

        upsertChunks.mockRejectedValueOnce(new Error('Qdrant недоступен'));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        expect(res.status).toBe(502);
        expect(res.body.error.code).toBe('QDRANT_INDEX_FAILED');
    });

    it('повторный вызов .../complete после QDRANT_INDEX_FAILED переиспользует уже созданный артефакт из MongoDB, а не генерирует новый через LLM', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;
        await collectStageFields(project, cookie, sessionId);

        upsertChunks.mockRejectedValueOnce(new Error('Qdrant недоступен'));

        const firstRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(firstRes.status).toBe(502);
        // Генерация артефакта — два вызова: структурированные поля и документ.
        expect(chatComplete).toHaveBeenCalledTimes(2);

        const retryRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        expect(retryRes.status).toBe(200);
        expect(retryRes.body.data.confirmed).toBe(true);
        // Reused, not regenerated: still only the calls from the first attempt.
        expect(chatComplete).toHaveBeenCalledTimes(2);

        const artifacts = await Artifact.find({ projectId: project._id });
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].status).toBe('confirmed');
    });

    it('POST .../complete возвращает 502 LLM_PROVIDER_FAILED (не 422/ARTIFACT_VALIDATION_FAILED), если падает сам вызов LLM при генерации артефакта', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;
        await collectStageFields(project, cookie, sessionId);

        // Ошибка без .code — как обычно бросает сам OpenAI SDK при сетевом сбое/rate limit,
        // а не наша собственная ARTIFACT_VALIDATION_FAILED-логика парсинга JSON.
        chatComplete.mockRejectedValueOnce(new Error('OpenAI API недоступен'));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});

        expect(res.status).toBe(502);
        expect(res.body.error.code).toBe('LLM_PROVIDER_FAILED');
    });

    it('SSE-событие error нормализует код до LLM_PROVIDER_FAILED, если падает сам стриминговый вызов LLM', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;

        chatCompleteStream.mockRejectedValueOnce(new Error('Соединение с OpenAI оборвалось'));

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/messages`)
            .set('Cookie', cookie)
            .send({ content: 'Привет' });

        expect(res.status).toBe(200);
        const events = parseSSE(res.text);
        const errorEvent = events.find((e) => e.event === 'error');
        expect(errorEvent.data.code).toBe('LLM_PROVIDER_FAILED');
    });
});

describe('Автозавершение Project.status', () => {
    async function completeAgent(cookie, project, agentId, sessionId) {
        await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({});
        return request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
    }

    it('подтверждение артефакта НЕ последнего агента (R1) не меняет Project.status', async () => {
        const { r1 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;
        await collectStageFields(project, cookie, sessionId);

        const completeRes = await completeAgent(cookie, project, r1._id, sessionId);
        expect(completeRes.status).toBe(200);

        const updatedProject = await Project.findById(project._id);
        expect(updatedProject.status).toBe('active');
    });

    it('подтверждение артефакта ПОСЛЕДНЕГО агента маршрута (nextAgentId=null) переводит Project.status в completed', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const r1SessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        await collectStageFields(project, cookie, r1SessionRes.body.data.session._id);
        await completeAgent(cookie, project, r1._id, r1SessionRes.body.data.session._id);

        const projectAfterR1 = await Project.findById(project._id);
        expect(String(projectAfterR1.currentAgentId)).toBe(String(r2._id));
        expect(projectAfterR1.status).toBe('active');

        const r2SessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r2._id) });
        const r2CompleteRes = await completeAgent(cookie, project, r2._id, r2SessionRes.body.data.session._id);
        expect(r2CompleteRes.status).toBe(200);
        expect(r2CompleteRes.body.data.nextAgentId).toBeNull();

        const projectAfterR2 = await Project.findById(project._id);
        expect(projectAfterR2.status).toBe('completed');
    });
});

describe('Гейт обязательных полей артефакта перед переходом на следующего агента', () => {
    it('confirmArtifact:true с артефактом без обязательного поля -> 422 ARTIFACT_VALIDATION_FAILED и проект НЕ переходит на R2', async () => {
        const { r1, r2 } = await seedAgents();
        const { owner, project } = await setupProject();
        const cookie = authCookie(owner._id, owner.email);

        const sessionRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions`)
            .set('Cookie', cookie)
            .send({ agentId: String(r1._id) });
        const sessionId = sessionRes.body.data.session._id;

        // Карточка этапа нужна заполненной, чтобы этап прошёл гейт готовности:
        // проверяем именно валидацию полей артефакта, а не отсутствие данных.
        await collectStageFields(project, cookie, sessionId);

        // Модель вернула JSON, где нет обязательного поля 'risks'
        // (r1.requiredFields = marketDescription, nicheHypothesis, competitors, risks, summary).
        chatComplete.mockResolvedValueOnce({
            content: JSON.stringify({
                marketDescription: 'Описание рынка',
                nicheHypothesis: 'Гипотеза ниши',
                competitors: 'Конкуренты',
                summary: 'Сводка'
            }),
            tokenUsage: { totalTokens: 10 }
        });

        const res = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });

        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('ARTIFACT_VALIDATION_FAILED');

        // Ключевой инвариант: проект остался на R1, маршрут не продвинулся.
        const projectAfter = await Project.findById(project._id);
        expect(String(projectAfter.currentAgentId)).toBe(String(r1._id));
        expect(projectAfter.completedAgentIds.map(String)).not.toContain(String(r1._id));
        expect(projectAfter.status).toBe('active');

        // Артефакт с неполными полями не должен был создаться вовсе.
        const artifacts = await Artifact.find({ projectId: project._id });
        expect(artifacts).toHaveLength(0);

        // Индексация в Qdrant подтверждённого артефакта тоже не запускалась.
        expect(upsertChunks).not.toHaveBeenCalled();

        // Убедимся, что после этого валидный артефакт всё-таки переводит на R2
        // (гейт именно на полях, а не общая блокировка).
        const okRes = await request(app)
            .post(`/api/v1/accelerator/projects/${project._id}/expert-sessions/${sessionId}/complete`)
            .set('Cookie', cookie)
            .send({ confirmArtifact: true });
        expect(okRes.status).toBe(200);

        const projectAdvanced = await Project.findById(project._id);
        expect(String(projectAdvanced.currentAgentId)).toBe(String(r2._id));
    });
});
