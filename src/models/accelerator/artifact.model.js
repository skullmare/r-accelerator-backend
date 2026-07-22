import mongoose from 'mongoose';

const ArtifactSchema = new mongoose.Schema({
    // Проект, которому принадлежит артефакт.
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    // Сессия, в рамках которой артефакт был сгенерирован — по ней можно
    // восстановить полную историю диалога, приведшую к этому результату.
    expertSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpertSession',
        required: true
    },
    // Агент, создавший артефакт. Дублирует agentId сессии — денормализация
    // ради простых выборок "все артефакты этого агента по проекту" без
    // джойна ExpertSession.
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    // Тип артефакта — берётся из Agent.artifactDefinition.artifactType в
    // момент генерации (не ссылка, а копия значения на момент создания:
    // если админ потом поменяет artifactType у агента, уже созданные
    // артефакты не изменятся).
    type: {
        type: String,
        required: true,
        trim: true
    },
    // Заголовок артефакта — из Agent.artifactDefinition.titleTemplate или
    // автосгенерированный fallback.
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    // Сам артефакт — JSON-объект, который вернула модель, прошедший
    // проверку requiredFields (и опционально outputSchema через ajv).
    // Обратите внимание: проверяется только структура/присутствие полей,
    // не правдивость содержимого — модель может «халлюцинировать» здесь.
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // Краткая сводка (берётся из content[summaryField]). Эта строка — то,
    // что реально уходит в Project.contextSummary следующим агентам и в
    // Qdrant как индексируемый текст при confirmArtifact:true.
    summary: {
        type: String,
        required: true,
        maxlength: 4000
    },
    // Жизненный цикл артефакта: draft — выставляется на миг при создании
    // записи и тут же перезаписывается ниже по коду в том же вызове
    // /complete, наружу практически никогда не "долетает"; ready —
    // черновик после первого /complete без confirmArtifact; confirmed —
    // после /complete с confirmArtifact:true (только в этом статусе
    // артефакт индексируется в Qdrant и двигает маршрут проекта);
    // rejected — не проставляется автоматически нигде, задел под будущий
    // сценарий отклонения черновика пользователем.
    status: {
        type: String,
        enum: ['draft', 'ready', 'confirmed', 'rejected'],
        default: 'draft'
    }
}, {
    timestamps: true
});

// Используется для выборок "все артефакты проекта" и "артефакт(ы)
// конкретного агента в проекте".
ArtifactSchema.index({ projectId: 1, agentId: 1 });

const Artifact = mongoose.model('Artifact', ArtifactSchema);
export default Artifact;
