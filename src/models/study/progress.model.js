import mongoose from 'mongoose';

const StudyProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyProgram', required: true },
    completedItems: [{ type: mongoose.Schema.Types.ObjectId }]
}, { timestamps: true });

StudyProgressSchema.index({ user: 1, program: 1 }, { unique: true });

const StudyProgress = mongoose.model('StudyProgress', StudyProgressSchema);
export default StudyProgress;
