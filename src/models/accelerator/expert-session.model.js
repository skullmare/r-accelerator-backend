import mongoose from 'mongoose';

// Сессия — диалог пользователя с одним агентом на одном этапе маршрута.
const ExpertSessionSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    // Агент этой сессии. Сессию можно открыть только с текущим агентом
    // проекта (Project.currentAgentId) — перепрыгнуть этап нельзя.
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    // Всего два состояния: идёт диалог или этап завершён (документ создан,
    // проект переключён на следующего агента).
    status: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active'
    },
    // Хранилище собранных данных: агент по ходу диалога складывает сюда всё,
    // что узнал о пользователе и проекте, вызывая инструмент save_data.
    // Ключи произвольные — их придумывает сам агент по своему промпту,
    // никакой схемы и обязательных полей нет. Из этих данных потом
    // формируется документ этапа.
    collectedData: {
        type: Map,
        of: String,
        default: () => new Map()
    },
    // Агент подтвердил, что условие завершения (Agent.completionPrompt)
    // выполнено — вызвал инструмент stage_ready. Это сигнал фронту показать
    // кнопку «сформировать документ». Завершение этапа сервер не блокирует:
    // флаг подсказывает момент, а не запрещает действие.
    readyForArtifact: {
        type: Boolean,
        default: false
    },
    // Документ, созданный при завершении этапа.
    artifactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artifact',
        default: null
    }
}, {
    timestamps: true
});

// Поиск активной сессии проекта по агенту.
ExpertSessionSchema.index({ projectId: 1, agentId: 1, createdAt: -1 });

const ExpertSession = mongoose.model('ExpertSession', ExpertSessionSchema);
export default ExpertSession;
