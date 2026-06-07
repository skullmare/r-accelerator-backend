import mongoose from 'mongoose';

const StudyLessonSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    video: {
        
    },
    presentation: {

    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        default: {
            type: 'doc',
            content: []
        }
    },
    questions: {

    }
}, {
    timestamps: true
});

const StudyLesson = mongoose.model('StudyLesson', StudyLessonSchema);
export default StudyLesson;