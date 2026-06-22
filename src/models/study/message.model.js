import mongoose from 'mongoose';

const StudyMessageSchema = new mongoose.Schema({
    messageText: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyAgent',
        required: true
    },
    author: {
        type: String,
        enum: ['agent', 'user'],
        required: true
    }
}, {
    timestamps: true
});

StudyMessageSchema.index({ user: 1, agent: 1, createdAt: -1 });

const StudyMessage = mongoose.model('StudyMessage', StudyMessageSchema);
export default StudyMessage;