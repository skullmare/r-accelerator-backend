import mongoose from 'mongoose';

// Generic, admin-defined AI agent — this schema makes no assumption about
// a fixed R1..R5 route. Агент идентифицируется своим _id (Mongo ObjectId,
// см. docs/open-questions.md почему нет отдельного code); порядок и
// маршрутизация между агентами полностью управляются данными через `order`
// и `nextAgentId`.
const AgentSchema = new mongoose.Schema({
    // Имя агента для интерфейса ("Роман"). В промпт модели не попадает —
    // это чисто отображаемое поле (для UI, логов, response'ов API).
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    // Краткое описание специализации ("Эксперт по рынку и нише") — тоже
    // только для UI/списков в админке, в промпт модели не подмешивается.
    roleTitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    // Порядковое место агента в маршруте. По нему сортируется список в
    // GET /admin/agents и GET expert-route, и по нему же resolveCurrentAgent
    // выбирает "первого активного агента", если у проекта ещё не выставлен
    // currentAgentId (самолечение для новых/старых проектов).
    order: {
        type: Number,
        required: true
    },
    // Если false — агент не участвует в пользовательском маршруте:
    // resolveCurrentAgent его игнорирует, а createSession отклонит попытку
    // создать сессию с этим агентом (AGENT_NOT_FOUND). Данные агента и уже
    // созданные артефакты/сессии при этом не удаляются — это временное
    // отключение, а не soft-delete.
    isActive: {
        type: Boolean,
        default: true
    },
    // Базовая системная инструкция роли ("Ты Роман, эксперт по рынку...").
    // Это первый и главный блок системного промпта, который реально уходит
    // в LLM при каждом сообщении и при генерации артефакта
    // (см. context-assembly.service.js).
    systemPrompt: {
        type: String,
        required: true,
        maxlength: 20000
    },
    // Текстовое описание того, когда этап считается завершённым ("собраны
    // marketDescription, nicheHypothesis..."). Добавляется в системный
    // промпт всегда, но это ТОЛЬКО инструкция для модели — сервер не
    // проверяет код это как хард-гейт перед вызовом /complete.
    completionCriteria: {
        type: String,
        required: true,
        maxlength: 5000
    },
    // Описание структуры финального артефакта этапа — используется и в
    // промпте (модели явно говорят, какие поля заполнить), и при валидации
    // её ответа в artifact-generation.service.js.
    artifactDefinition: {
        // Тип артефакта ("market_brief") — попадает в Artifact.type и в
        // текст инструкции модели при генерации артефакта.
        artifactType: { type: String, required: true, trim: true, maxlength: 100 },
        // Шаблон заголовка артефакта. Если не задан — заголовок собирается
        // автоматически как "{agent.name}: {artifactType}".
        titleTemplate: { type: String, trim: true, default: null, maxlength: 200 },
        // Список ключей JSON, которые модель обязана заполнить непустыми
        // значениями. Используется дважды: перечисляется в инструкции модели
        // ("ответь JSON с полями: ...") и проверяется после ответа —
        // отсутствие/пустота любого поля даёт ARTIFACT_VALIDATION_FAILED.
        requiredFields: { type: [String], default: [] },
        // Необязательная полноценная JSON Schema для более строгой проверки
        // через ajv (типы полей, а не только "поле не пустое"). Если схема
        // сама невалидна как JSON Schema — проверка тихо пропускается,
        // отказа не будет (см. docs/expert-context.md).
        outputSchema: { type: mongoose.Schema.Types.Mixed, default: null },
        // Какое поле из сгенерированного JSON использовать как краткую
        // сводку артефакта (Artifact.summary). Эта сводка потом уходит и в
        // Project.contextSummary, и в Qdrant как индексируемый текст.
        summaryField: { type: String, trim: true, default: 'summary', maxlength: 100 }
    },
    // _id следующего агента маршрута. Используется только в момент
    // confirmArtifact:true — completeSession переключает
    // Project.currentAgentId на это значение. Если null — маршрут для
    // проекта на этом агенте заканчивается.
    nextAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        default: null
    },
    // Настройки того, какой контекст подмешивать этому агенту в промпт.
    contextPolicy: {
        // Включать ли Project.contextSummary в системный промпт. По ТЗ
        // сводка проекта должна попадать в промпт всегда — этот флаг даёт
        // администратору возможность осознанно отключить это для
        // конкретного агента, если понадобится.
        includeProjectSummary: { type: Boolean, default: true },
        // Включать ли sourceType=artifact (артефакты предыдущих этапов) в
        // Qdrant-поиск для этого агента.
        includePreviousArtifacts: { type: Boolean, default: true },
        // Сколько фрагментов забирать из Qdrant-поиска (топ-K по similarity).
        qdrantTopK: { type: Number, default: 6, min: 1, max: 20 },
        // Верхний лимит суммарной длины retrieved-контекста в символах —
        // защита от разрастания промпта и лишних токенов.
        maxContextChars: { type: Number, default: 6000, min: 500, max: 40000 },
        // Какие sourceType участвуют в Qdrant-поиске для этого агента
        // (project_summary/agent_summary/artifact/file_chunk/user_note).
        allowedSourceTypes: {
            type: [String],
            default: ['project_summary', 'artifact', 'file_chunk']
        },
        // Сколько фрагментов забирать из базы знаний (knowledge_context)
        // при поиске по привязанным этому агенту knowledgeIds.
        knowledgeTopK: { type: Number, default: 6, min: 1, max: 20 },
        // Верхний лимит суммарной длины knowledge-контекста в символах —
        // отдельный бюджет от maxContextChars проектного контекста.
        knowledgeMaxContextChars: { type: Number, default: 6000, min: 500, max: 40000 }
    },
    // Список _id глобальных баз знаний (Knowledge), которые администратор
    // привязал этому агенту. Только по ним ведётся поиск в knowledge_context
    // — это точка изоляции: пустой массив = агент не получает знаний. См.
    // context-assembly.service.js и docs/expert-context.md.
    knowledgeIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Knowledge' }],
        default: []
    },
    // Настройки конкретного LLM-вызова для этого агента. Провайдер сейчас
    // всегда OpenAI (см. src/services/llm.service.js) — отдельного поля
    // provider нет, выбирать нечего.
    modelConfig: {
        // Имя модели OpenAI ("gpt-4o-mini").
        model: { type: String, trim: true, default: 'gpt-4o-mini' },
        // Температура генерации — выше значение, разнообразнее (и менее
        // предсказуемее) ответы модели.
        temperature: { type: Number, default: 0.4, min: 0, max: 2 },
        // Лимит токенов на ОТВЕТ модели (не на входной контекст — тот
        // ограничивается maxContextChars выше).
        maxTokens: { type: Number, default: 1500, min: 100, max: 8000 }
    }
}, {
    timestamps: true
});

AgentSchema.index({ order: 1 });

const Agent = mongoose.model('Agent', AgentSchema);
export default Agent;
