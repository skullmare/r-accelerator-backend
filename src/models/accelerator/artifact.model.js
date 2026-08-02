import mongoose from 'mongoose';

// Артефакт — итоговый документ этапа. Для пользователя это PDF (file.url),
// для следующих агентов — summary (уходит в Project.contextSummary) и текст
// документа (индексируется в Qdrant).
//
// Ни JSON-содержимого, ни статусов черновик/подтверждён здесь больше нет:
// артефакт создаётся один раз, в момент завершения этапа, и сразу является
// финальным.
const ArtifactSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    // Сессия, по итогам которой создан документ — через неё восстанавливается
    // весь диалог и собранные данные.
    expertSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpertSession',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    // Исходник документа в Markdown — из него свёрстан PDF. Хранится, чтобы
    // можно было перерендерить файл без повторного обращения к модели.
    documentMarkdown: {
        type: String,
        required: true
    },
    // Краткая сводка этапа. Собирается из данных, которые агент сохранил в
    // диалоге, — именно она уходит в контекст следующего агента.
    summary: {
        type: String,
        required: true,
        maxlength: 4000
    },
    // Сгенерированный PDF в S3 — то, что пользователь скачивает.
    file: {
        key: { type: String, default: null },
        url: { type: String, default: null },
        mimeType: { type: String, default: 'application/pdf' },
        size: { type: Number, default: null }
    }
}, {
    timestamps: true
});

ArtifactSchema.index({ projectId: 1, agentId: 1 });

const Artifact = mongoose.model('Artifact', ArtifactSchema);
export default Artifact;
