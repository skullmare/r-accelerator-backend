import mongoose from 'mongoose';

const CourseMessageSchema = new mongoose.Schema({
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
        ref: 'CourseAgent',
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

CourseMessageSchema.index({ user: 1, agent: 1, createdAt: -1 });

const CourseMessage = mongoose.model('CourseMessage', CourseMessageSchema);
export default CourseMessage;