import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpertSession',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    senderType: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 20000
    },
    tokenUsage: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

MessageSchema.index({ sessionId: 1, createdAt: 1 });

const Message = mongoose.model('Message', MessageSchema);
export default Message;
