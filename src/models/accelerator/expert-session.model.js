import mongoose from 'mongoose';

const ExpertSessionSchema = new mongoose.Schema({
    // Проект, в рамках которого идёт диалог с агентом. Все сообщения и
    // артефакт сессии наследуют эту привязку.
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    // Агент, с которым идёт эта сессия. createSession допускает создание
    // сессии только для агента, совпадающего с текущим
    // Project.currentAgentId (иначе 409 AGENT_NOT_CURRENT) — то есть
    // "перепрыгнуть" через агента, минуя маршрут, нельзя.
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    // Статус сессии. draft/active — обычный диалог; waiting_user_confirmation —
    // артефакт сгенерирован как черновик (status=ready), но ещё не
    // подтверждён; completed — артефакт подтверждён, Project.currentAgentId
    // уже переключён на следующего агента; failed сейчас нигде не
    // проставляется автоматически (задел на будущее).
    status: {
        type: String,
        enum: ['draft', 'active', 'waiting_user_confirmation', 'completed', 'failed'],
        default: 'active'
    },
    // Снимок того, что реально ушло в системный промпт при последнем
    // сообщении: был ли подмешан summary проекта и какие именно чанки
    // подтянулись из Qdrant (см. assembleContext). Это аудит-лог для
    // отладки "почему модель ответила именно так", а не рабочие данные.
    inputContextSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Краткая сводка результата сессии — дублирует Artifact.summary после
    // завершения, чтобы не ходить в коллекцию Artifact ради одного поля
    // при отображении списка сессий.
    outputSummary: {
        type: String,
        trim: true,
        default: null
    },
    // Ссылка на созданный артефакт этапа. Появляется уже на первом (черновом)
    // вызове /complete и переиспользуется при повторном вызове с
    // confirmArtifact:true — второй вызов НЕ генерирует артефакт заново,
    // а подтверждает уже существующий.
    artifactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artifact',
        default: null
    }
}, {
    timestamps: true
});

// Используется в createSession (найти активную сессию для агента в
// проекте) и при подгрузке истории сообщений сессии.
ExpertSessionSchema.index({ projectId: 1, agentId: 1, createdAt: -1 });

const ExpertSession = mongoose.model('ExpertSession', ExpertSessionSchema);
export default ExpertSession;
