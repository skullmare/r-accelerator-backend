import mongoose from 'mongoose';

const StudyAgentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    role: {
        type: String,
        maxlength: 100,
        default: null
    },
    avatar: {
        type: String,
        required: true
    },
    baseMessages: [{
        // пока что не используем
        type: String
    }],
    openAiAssistantId: {
        type: String,
        required: true
    },
    prompt: {
        // пока что не используем
        type: String
    },
    docs: [{
        // пока что не используем
        type: String
    }]
}, {
    timestamps: true
});

const StudyAgent = mongoose.model('StudyAgent', StudyAgentSchema);
export default StudyAgent;