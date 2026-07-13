import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
    // Оригинальное имя файла (как назывался у пользователя на диске).
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Публичная ссылка на объект в Yandex Cloud S3.
    url: {
        type: String,
        required: true,
        trim: true
    },
    // MIME-тип файла — по нему выбирается экстрактор текста
    // (getExtractor(file.type) в extractors/index.js): TXT/MD, PDF, DOCX
    // поддерживаются, остальное сразу помечается unsupported.
    type: {
        type: String,
        required: true
    },
    // Размер файла в байтах (метаданные, для отображения в UI).
    size: {
        type: Number,
        required: true
    },
    // Кто загрузил файл — по этому полю фильтруется список файлов
    // пользователя в GET /file.
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Загружен пользователем или создан системой — сейчас всегда 'user'
    // для файлов через /file/upload и /file/multipart/complete.
    source: {
        type: String,
        enum: ['user', 'system'],
        required: true,
        default: 'system'
    },
    // Проект Р-Акселератора, к которому привязан файл. Если задан —
    // именно это поле включает автоматическую постановку файла в очередь
    // на обработку/индексацию (см. complete-upload.controller.js). Если
    // null — файл обычный, вне экспертного контекста, не обрабатывается.
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    },
    // Ключ объекта в S3 (путь внутри бакета) — нужен воркеру, чтобы
    // скачать/стримить файл через GetObjectCommand при обработке.
    // Отдельно от url, чтобы не парсить его каждый раз.
    key: {
        type: String,
        default: null
    },
    // Текущий шаг пайплайна обработки файла (см. process-file.job.js):
    // uploaded — загружен, ждёт очереди; extracting — воркер читает и
    // чанкует текст; indexing/indexed — идёт или завершилась запись в
    // Qdrant; failed — ошибка на любом шаге (см. processingError);
    // unsupported — формат не поддерживается или файл превысил лимит
    // размера для формата (PDF/DOCX).
    processingStatus: {
        type: String,
        enum: ['uploaded', 'extracting', 'extracted', 'indexing', 'indexed', 'failed', 'unsupported'],
        default: 'uploaded'
    },
    // Результат именно шага извлечения текста: success — есть текст;
    // empty — файл распознан, но текста в нём не нашлось; failed —
    // извлечение упало; unsupported — для этого формата нет экстрактора.
    extractedTextStatus: {
        type: String,
        enum: ['not_started', 'success', 'empty', 'failed', 'unsupported'],
        default: 'not_started'
    },
    // Результат именно шага записи в Qdrant (отдельно от extractedTextStatus,
    // т.к. текст может извлечься успешно, а запись в Qdrant — упасть).
    qdrantStatus: {
        type: String,
        enum: ['not_indexed', 'indexed', 'failed', 'stale'],
        default: 'not_indexed'
    },
    // Id точек, созданных в Qdrant из чанков этого файла — используется
    // при повторной индексации (deleteBySource чистит старые точки перед
    // тем как записать новые) и отдаётся в processing-status как
    // qdrantPointsCount.
    qdrantPointIds: {
        type: [String],
        default: []
    },
    // Хэш всего извлечённого текста (посчитан потоково — hash от хэшей
    // отдельных чанков, не от самого текста целиком). Задел на будущее:
    // сравнивая его при повторной индексации, можно пропускать
    // переиндексацию, если текст файла не изменился.
    textHash: {
        type: String,
        default: null
    },
    // Первые ~300 символов извлечённого текста — для отображения в UI/для
    // отладки, без похода в Qdrant за содержимым.
    extractedTextPreview: {
        type: String,
        default: null
    },
    // Короткое безопасное описание последней ошибки обработки (без
    // стектрейса) — то, что можно показать пользователю в UI.
    processingError: {
        type: String,
        default: null
    },
    // Момент последней успешной индексации в Qdrant.
    indexedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

// Используется списком файлов проекта (GET .../projects/:id/files) и
// поиском конкретного файла в контексте проекта.
FileSchema.index({ projectId: 1 });

const File = mongoose.model('File', FileSchema);
export default File;
