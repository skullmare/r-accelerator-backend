import mongoose from 'mongoose';

const ModuleItemSchema = new mongoose.Schema({
    // Какого рода элемент — урок или обучающий агент. Определяет, в какую
    // коллекцию смотрит refPath ниже, и используется и через Mongoose
    // populate (get-program.controller.js: .populate('modules.items.item')),
    // и вручную веткой if/else при сборке прогресса
    // (get-progress.controller.js смотрит на type, чтобы понять, в какой
    // карте — уроков или агентов — искать этот item).
    type: {
        type: String,
        enum: ['StudyLesson', 'StudyAgent'],
        required: true
    },
    // Id конкретного урока или агента; refPath: 'type' говорит Mongoose,
    // в какую коллекцию идти при populate — динамически, по значению type
    // этого же поддокумента.
    item: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'type'
    }
});

const ModuleSchema = new mongoose.Schema({
    // Название модуля программы.
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Уроки/агенты внутри модуля, в порядке прохождения — этот порядок и
    // используется check-item-unlocked.middleware.js для определения
    // "предыдущего элемента", который должен быть пройден при
    // sequential=true.
    items: [ModuleItemSchema]
});

const StudyProgramSchema = new mongoose.Schema({
    // Название программы обучения.
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Описание программы для каталога.
    description: {
        type: String,
        trim: true,
        default: null
    },
    // Технические метаданные обложки из S3 (например, размер/тип) —
    // произвольная структура, задаётся на загрузке обложки.
    coverMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Модули программы, каждый со своим списком уроков/агентов.
    modules: [ModuleSchema],
    // Если true — элементы программы открываются строго по порядку
    // (check-item-unlocked.middleware.js блокирует доступ, пока не пройден
    // предыдущий элемент по StudyProgress.completedItems). Если false —
    // доступ ко всем элементам открыт сразу.
    sequential: {
        type: Boolean,
        default: true,
        required: true
    },
    // Активна ли программа. join-program.controller.js ищет программу по
    // qrCode только среди active:true — по неактивной программе
    // присоединиться нельзя.
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    // URL обложки программы для каталога.
    cover: {
        type: String,
        default: null
    },
    // Уникальный код (по факту — SHA-256 хэш, несмотря на имя "QR") для
    // присоединения к программе. join-program.controller.js ищет программу
    // по этому полю и добавляет её _id в User.studyPrograms — это ключ
    // приглашения, не хранимое изображение QR-кода.
    qrCode: {
        type: String,
        required: true,
        unique: true,
    }
}, {
    timestamps: true
});

const StudyProgram = mongoose.model('StudyProgram', StudyProgramSchema);
export default StudyProgram;
