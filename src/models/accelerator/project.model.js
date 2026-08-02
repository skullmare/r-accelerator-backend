import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
    // Владелец проекта — единственный, кому разрешён доступ
    // (см. check-access-project.middleware.js). Все проектные данные
    // (файлы, сессии, артефакты) видны только через владение проектом.
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Название проекта/стартапа, задаётся пользователем.
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Свободное описание проекта от пользователя.
    description: {
        type: String,
        trim: true,
        default: null
    },
    // Роль пользователя в проекте (например "основатель").
    userRole: {
        type: String,
        trim: true,
        default: null
    },
    // Отрасль/индустрия проекта.
    industry: {
        type: String,
        trim: true,
        default: null
    },
    // Специфика бизнеса — свободный текст с деталями, которые не
    // укладываются в отдельные поля.
    businessSpecifics: {
        type: String,
        trim: true,
        default: null
    },
    // Стадия проекта (идея / MVP / запущен / рост / масштабирование).
    stage: {
        type: String,
        enum: ['idea', 'mvp', 'launched', 'growth', 'scale'],
        default: 'idea'
    },
    // Текущая цель пользователя по проекту.
    goal: {
        type: String,
        trim: true,
        default: null
    },
    // Статус проекта. Пользователь меняет его вручную (пауза/архив) через
    // PATCH. Единственный автоматический переход — на 'completed', когда
    // завершён этап последнего агента маршрута (следующего агента больше
    // нет), см. expert-session.service.js. Само значение status не влияет на
    // доступ к маршруту — это отражение состояния, а не гейт.
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'archived'],
        default: 'active'
    },
    // _id агента, который сейчас активен для этого проекта. null у нового
    // проекта — проставляется при первом обращении к маршруту
    // (resolveCurrentAgent в expert-session.service.js подставляет первого
    // агента по order и сохраняет сюда).
    currentAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        default: null
    },
    // Список _id агентов, чьи этапы уже пройдены (артефакт подтверждён).
    // Используется в GET expert-route, чтобы показать статус "completed"
    // для пройденных этапов маршрута.
    completedAgentIds: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Agent',
        default: []
    },
    // Краткая сводка проекта, накапливаемая по мере прохождения этапов —
    // при завершении этапа сюда дописывается summary нового артефакта
    // (см. appendContextSummary в expert-session.service.js). Это
    // единственное поле, которое ВСЕГДА подмешивается в промпт любого
    // агента, независимо от результатов поиска в Qdrant.
    contextSummary: {
        type: String,
        trim: true,
        default: null
    },
    // Счётчик версий contextSummary — увеличивается на 1 при каждом
    // обновлении. Отдаётся клиенту в ответе /complete
    // (projectContextVersion), чтобы фронт мог понять, что контекст
    // проекта изменился.
    contextVersion: {
        type: Number,
        default: 0
    },
    // Дата последней активности по проекту — обновляется при завершении
    // этапа.
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

ProjectSchema.index({ ownerId: 1 });

const Project = mongoose.model('Project', ProjectSchema);
export default Project;
