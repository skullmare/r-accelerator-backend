// Демонстрационные агенты для сквозной проверки маршрута: Роман (order 1) ->
// Регина (order 2). Это не часть бизнес-логики — просто данные, заведённые
// через ту же модель Agent, что и админский CRUD.
//
// Агенты не связаны через nextAgentId: маршрут строится по order, и для
// линейной цепочки этого достаточно.
// Запуск: node scripts/seed-demo-agents.js
import 'dotenv/config';
import db from '../config/mongo.config.js';
import Agent from '../src/models/accelerator/agent.model.js';

async function upsertByName(name, data) {
    return Agent.findOneAndUpdate(
        { name },
        data,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
}

async function seedDemoAgents() {
    await db.connectDB();

    const roman = await upsertByName('Роман', {
        name: 'Роман',
        description: 'Эксперт по рынку и нише',
        order: 1,
        systemPrompt:
            'Ты Роман, эксперт по рынку и нише для стартап-акселератора. Помоги основателю описать рынок, ' +
            'сформулировать гипотезу ниши, выявить конкурентов и ключевые риски.\n\n' +
            'Веди живой диалог: задавай вопросы по одному, уточняй расплывчатые ответы, предлагай ' +
            'формулировки, если человек затрудняется. Всё существенное, что узнал, сразу сохраняй ' +
            'инструментом save_data — например, под ключами market, niche, competitors, risks.',
        completionPrompt:
            'Этап завершён, когда понятно: какой это рынок, в чём гипотеза ниши, кто основные конкуренты ' +
            'и какие риски у затеи. Формулировки могут быть черновыми — важно, чтобы по каждому из ' +
            'четырёх пунктов был осмысленный ответ пользователя, а не догадка.',
        nextAgentId: null
    });
    console.log(`Агент "Роман" готов (_id: ${roman._id})`);

    const regina = await upsertByName('Регина', {
        name: 'Регина',
        description: 'Эксперт по целевой аудитории',
        order: 2,
        systemPrompt:
            'Ты Регина, эксперт по целевой аудитории. Опираясь на рыночный бриф предыдущего этапа, ' +
            'помоги основателю определить сегменты аудитории, их задачи и боли, а затем выбрать ' +
            'приоритетный сегмент.\n\n' +
            'Веди живой диалог: задавай вопросы по одному. Всё существенное сразу сохраняй ' +
            'инструментом save_data — например, под ключами segments, jobsToBeDone, pains, ' +
            'prioritySegment.',
        completionPrompt:
            'Этап завершён, когда описаны сегменты аудитории с их задачами и болями и выбран ' +
            'приоритетный сегмент с кратким обоснованием.',
        nextAgentId: null
    });
    console.log(`Агент "Регина" готов (_id: ${regina._id})`);

    await db.disconnectDB();
}

seedDemoAgents()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Ошибка при заведении демо-агентов:', error);
        process.exit(1);
    });
