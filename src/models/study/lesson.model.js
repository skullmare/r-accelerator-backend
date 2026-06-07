import mongoose from 'mongoose';

const AnswerOptionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    isCorrect: {
        type: Boolean,
        required: true,
        default: false
    }
});

const QuestionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true,
        trim: true
    },
    answerOptions: [AnswerOptionSchema]
});

const StudyLessonSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
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
    },
    questions: [QuestionSchema]
}, {
    timestamps: true
});

const StudyLesson = mongoose.model('StudyLesson', StudyLessonSchema);
export default StudyLesson;