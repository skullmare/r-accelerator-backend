import mongoose from 'mongoose';

const StudyLessonSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    cover: {
        type: String,
        default: null
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LessonGroup',
        default: null
    },
    video: {
        url: String
    },
    presentation: {
        url: String
    },
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