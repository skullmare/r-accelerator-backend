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
    // Карточка этапа: данные, собранные агентом в диалоге, — по одному ключу на
    // обязательное поле артефакта (artifactDefinition.requiredFields, кроме
    // summaryField). Заполняется агентом через инструмент save_collected_fields
    // по ходу разговора и рендерится ему же в системный промпт на каждом ходу,
    // так что агент всегда видит актуальную заполненность и знает, что
    // спрашивать дальше (см. field-collection.service.js).
    //
    // quote — дословный фрагмент реплики пользователя, на основании которого
    // поле заполнено. Он проверяется на вхождение в реальные сообщения сессии,
    // то есть агент не может закрыть поле данными, которых пользователь не
    // давал. sourceMessageId — сообщение, после которого поле записали
    // (аудит-след для разбора «откуда это взялось»).
    collectedFields: {
        type: Map,
        of: new mongoose.Schema({
            value: { type: String, required: true },
            quote: { type: String, required: true },
            sourceMessageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Message',
                default: null
            },
            updatedAt: { type: Date, default: Date.now }
        }, { _id: false }),
        default: () => new Map()
    },
    // Однократный бэкфилл карточки для сессий, начатых до перехода на
    // save_collected_fields: у них история диалога есть, а collectedFields
    // пуста, и без переноса агент переспросил бы всё заново. Дата фиксирует,
    // что попытка уже была, — повторно модель на это не тратится.
    fieldsBackfilledAt: {
        type: Date,
        default: null
    },
    // Готовность этапа. Раньше — вердикт отдельной модели-оценщика, теперь
    // арифметика по collectedFields: ready=true, когда заполнены все поля
    // карточки (см. syncCompletionState). Форма объекта не изменилась, потому
    // что на неё завязан фронт: он отдаётся в SSE-событии done и в истории
    // сообщений, и по нему решается, показывать ли кнопку «сформировать
    // артефакт». Он же служит гейтом в completeSession: при ready=false этап не
    // завершить (если у агента не включён allowPartialCompletion).
    //
    // evaluatedAt / evaluatedAfterMessageId — момент и сообщение последнего
    // пересчёта. Пересчёт больше не требует вызова модели, поэтому «устаревшего»
    // состояния как проблемы больше нет: гейт просто считает поля заново.
    completionState: {
        ready: { type: Boolean, default: false },
        missingFields: { type: [String], default: [] },
        reason: { type: String, default: null },
        evaluatedAt: { type: Date, default: null },
        evaluatedAfterMessageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null
        }
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
