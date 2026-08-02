import mongoose from 'mongoose';

// Knowledge — глобальная единица базы знаний для агентов Р-Акселератора.
// Создаётся только из админки (право accelerator_knowledge.manage). Источник
// текста — файл: либо уже загруженный в S3 (fileId → File), либо внешняя
// ссылка (sourceUrl). Векторизуется в отдельную Qdrant-коллекцию
// (knowledge_context), точки фильтруются по knowledgeId. Не привязана к
// проекту/пользователю — одни и те же знания можно раздать разным агентам
// через Agent.knowledgeIds. См. docs/accelerator/README.md.
const KnowledgeSchema = new mongoose.Schema({
    // Название базы знаний для интерфейса админки.
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    // Необязательное описание — для чего эти знания, чисто для UI.
    description: {
        type: String,
        trim: true,
        default: null,
        maxlength: 2000
    },
    // Источник — ровно один из двух. fileId ссылается на уже загруженный
    // File (переиспользуем его key в S3 и type). sourceUrl — произвольная
    // внешняя ссылка, скачивается по HTTP при обработке. Валидация "ровно
    // один задан" — на уровне zod-схемы (knowledge.schema.js).
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        default: null
    },
    sourceUrl: {
        type: String,
        trim: true,
        default: null
    },
    // MIME-тип, по которому выбирался экстрактор при последней обработке
    // (проставляется процессом обработки: из File.type или из Content-Type
    // скачанной ссылки). Только для отображения/отладки.
    sourceMimeType: {
        type: String,
        default: null
    },
    // Статус синхронной обработки/индексации:
    // pending — создана, ещё не обрабатывалась; processing — идёт извлечение
    // текста и запись в Qdrant; indexed — успешно проиндексирована;
    // unsupported — формат файла без экстрактора; failed — ошибка обработки.
    status: {
        type: String,
        enum: ['pending', 'processing', 'indexed', 'unsupported', 'failed'],
        default: 'pending'
    },
    // Кол-во проиндексированных чанков (для отображения в админке).
    chunksCount: {
        type: Number,
        default: 0
    },
    // Id точек в Qdrant, созданных из этой knowledge — на будущее и для
    // прозрачности (реальная чистка идёт по фильтру knowledgeId).
    qdrantPointIds: {
        type: [String],
        default: []
    },
    // Хэш всего извлечённого текста (потоковый — хэш от хэшей чанков).
    textHash: {
        type: String,
        default: null
    },
    // Короткое безопасное описание последней ошибки обработки (для UI).
    processingError: {
        type: String,
        default: null
    },
    // Машиночитаемый код последней ошибки (стабильное значение для фронта):
    // сейчас основное — QDRANT_INDEX_FAILED (текст извлёкся, упала запись в
    // Qdrant) и SOURCE_FETCH_FAILED (не удалось скачать файл/ссылку).
    processingErrorCode: {
        type: String,
        default: null
    },
    // Момент последней успешной индексации.
    indexedAt: {
        type: Date,
        default: null
    },
    // Кто создал запись (админ). Для аудита.
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

const Knowledge = mongoose.model('Knowledge', KnowledgeSchema);
export default Knowledge;
