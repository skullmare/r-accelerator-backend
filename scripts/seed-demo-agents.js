// Демонстрационные тестовые агенты R1 (Роман) и R2 (Регина) для сквозной
// проверки маршрута R1 -> R2 из ТЗ спринта 3. Это не часть бизнес-логики —
// это просто данные, заведённые через ту же generic-модель Agent, которой
// пользуется административный CRUD (POST /accelerator/admin/agents).
// Агенты ссылаются друг на друга по _id (nextAgentId), поэтому Регина
// создаётся первой, а её _id подставляется в nextAgentId Романа.
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

    const regina = await upsertByName('Регина', {
        name: 'Регина',
        roleTitle: 'Эксперт по целевой аудитории',
        order: 2,
        isActive: true,
        systemPrompt:
            'Ты Регина, эксперт по целевой аудитории. Опираясь на рыночный бриф от Романа, ' +
            'помоги пользователю определить сегменты аудитории, их задачи (jobs to be done), ' +
            'боли и альтернативы, а затем выбрать приоритетный сегмент.',
        completionCriteria:
            'Этап завершён, когда собраны: сегменты аудитории, jobs to be done, боли, альтернативы ' +
            'и выбран приоритетный сегмент с кратким обоснованием.',
        artifactDefinition: {
            artifactType: 'audience_brief',
            titleTemplate: 'Бриф целевой аудитории',
            requiredFields: ['targetSegments', 'jobsToBeDone', 'pains', 'alternatives', 'prioritySegment', 'summary'],
            summaryField: 'summary'
        },
        nextAgentId: null,
        contextPolicy: {
            includeProjectSummary: true,
            includePreviousArtifacts: true,
            qdrantTopK: 6,
            maxContextChars: 6000,
            allowedSourceTypes: ['project_summary', 'artifact', 'file_chunk']
        },
        modelConfig: { model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1500 }
    });
    console.log(`Агент "Регина" готов (_id: ${regina._id})`);

    const roman = await upsertByName('Роман', {
        name: 'Роман',
        roleTitle: 'Эксперт по рынку и нише',
        order: 1,
        isActive: true,
        systemPrompt:
            'Ты Роман, эксперт по рынку и нише для стартап-акселератора. ' +
            'Помоги пользователю описать рынок, сформулировать гипотезу ниши, ' +
            'выявить конкурентов и риски. Задавай уточняющие вопросы по одному.',
        completionCriteria:
            'Этап завершён, когда собраны: описание рынка, гипотеза ниши, список конкурентов, ' +
            'ключевые риски и краткая сводка. Открытые вопросы допустимы, но должны быть перечислены явно.',
        artifactDefinition: {
            artifactType: 'market_brief',
            titleTemplate: 'Рыночный бриф',
            requiredFields: ['marketDescription', 'nicheHypothesis', 'competitors', 'risks', 'summary'],
            summaryField: 'summary'
        },
        nextAgentId: regina._id,
        contextPolicy: {
            includeProjectSummary: true,
            includePreviousArtifacts: true,
            qdrantTopK: 6,
            maxContextChars: 6000,
            allowedSourceTypes: ['project_summary', 'artifact', 'file_chunk']
        },
        modelConfig: { model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1500 }
    });
    console.log(`Агент "Роман" готов (_id: ${roman._id}, nextAgentId -> Регина)`);

    await db.disconnectDB();
}

seedDemoAgents()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Ошибка при заведении демо-агентов:', error);
        process.exit(1);
    });
