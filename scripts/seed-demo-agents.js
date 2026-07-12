// Демонстрационные тестовые агенты R1 (Роман) и R2 (Регина) для сквозной
// проверки маршрута R1 -> R2 из ТЗ спринта 3. Это не часть бизнес-логики —
// это просто данные, заведённые через ту же generic-модель Agent, которой
// пользуется административный CRUD (POST /accelerator/admin/agents).
// Запуск: node scripts/seed-demo-agents.js
import 'dotenv/config';
import db from '../config/mongo.config.js';
import Agent from '../src/models/accelerator/agent.model.js';

const AGENTS = [
    {
        code: 'R1',
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
        nextAgentCode: 'R2',
        contextPolicy: {
            includeProjectSummary: true,
            includePreviousArtifacts: true,
            qdrantTopK: 6,
            maxContextChars: 6000,
            allowedSourceTypes: ['project_summary', 'artifact', 'file_chunk']
        },
        modelConfig: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1500 }
    },
    {
        code: 'R2',
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
        nextAgentCode: null,
        contextPolicy: {
            includeProjectSummary: true,
            includePreviousArtifacts: true,
            qdrantTopK: 6,
            maxContextChars: 6000,
            allowedSourceTypes: ['project_summary', 'artifact', 'file_chunk']
        },
        modelConfig: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1500 }
    }
];

async function seedDemoAgents() {
    await db.connectDB();

    for (const agentData of AGENTS) {
        await Agent.findOneAndUpdate(
            { code: agentData.code },
            agentData,
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log(`Агент ${agentData.code} (${agentData.name}) готов`);
    }

    await db.disconnectDB();
}

seedDemoAgents()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Ошибка при заведении демо-агентов:', error);
        process.exit(1);
    });
