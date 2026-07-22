import mongoose from 'mongoose';

const StudyLessonSchema = new mongoose.Schema({
    // Название урока, отображается в списках/модулях программы.
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // URL обложки урока.
    cover: {
        type: String,
        default: null
    },
    // Группа, к которой относится урок — только для группировки в UI
    // (list-lessons.controller.js делает .populate('group', 'name')).
    // Серверной фильтрации/логики доступа по группе нет.
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LessonGroup',
        default: null
    },
    // Ссылка на видео урока.
    video: {
        url: String
    },
    // Ссылка на презентацию урока.
    presentation: {
        url: String
    },
    // Содержимое урока в формате TipTap/ProseMirror JSON-документа.
    // Хранится и отдаётся как есть — сервер не парсит и не трансформирует
    // его, рендер/редактирование целиком на стороне клиента.
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        default: {
            type: 'doc',
            content: []
        }
    }
}, {
    timestamps: true
});

const StudyLesson = mongoose.model('StudyLesson', StudyLessonSchema);
export default StudyLesson;
