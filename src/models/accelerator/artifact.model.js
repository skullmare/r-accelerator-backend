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
    // Структурированные данные артефакта — JSON-объект, который вернула
    // модель, прошедший проверку requiredFields (и опционально outputSchema
    // через ajv). Для пользователя основной результат этапа — PDF (см. поле
    // file ниже), а этот слой обслуживает передачу контекста дальше по
    // маршруту: он индексируется в Qdrant и из него берётся summary.
    // Обратите внимание: проверяется только структура/присутствие полей,
    // не правдивость содержимого — модель может «халлюцинировать» здесь.
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // Текст документа в Markdown — то, что модель написала для PDF. Хранится
    // как исходник вёрстки: позволяет перерендерить файл (например, после
    // смены шаблона) без повторного обращения к LLM.
    documentMarkdown: {
        type: String,
        default: null
    },
    // Сгенерированный PDF в S3 — то, что пользователь скачивает как результат
    // этапа. Заполняется всегда: артефакт не создаётся, если рендер или
    // загрузка не удались (ARTIFACT_RENDER_FAILED / ARTIFACT_UPLOAD_FAILED),
    // поэтому записи без файла в базе не появляются.
    file: {
        key: { type: String, default: null },
        url: { type: String, default: null },
        mimeType: { type: String, default: 'application/pdf' },
        size: { type: Number, default: null },
        generatedAt: { type: Date, default: null }
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
    // rejected — проставляется, когда пользователь запросил перегенерацию
    // черновика (/complete с regenerate:true): прежний артефакт остаётся в
    // базе как история попыток, а сессия перепривязывается к новому.
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
