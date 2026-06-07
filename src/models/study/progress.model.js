import mongoose from 'mongoose';

const LessonDetailSchema = new mongoose.Schema({
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLesson', required: true },
    quizAnswers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        answerId: { type: mongoose.Schema.Types.ObjectId, required: true }
    }]
}, { _id: false });

const StudyProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyProgram', required: true },
    completedItems: [{ type: mongoose.Schema.Types.ObjectId }],
    lessonDetails: [LessonDetailSchema]
}, { timestamps: true });

StudyProgressSchema.index({ user: 1, program: 1 }, { unique: true });

const StudyProgress = mongoose.model('StudyProgress', StudyProgressSchema);
export default StudyProgress;