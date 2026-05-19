import mongoose from 'mongoose';

const CourseAgentSchema = new mongoose.Schema({
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
    avatar: {
        type: String,
        required: true
    },
    baseMessages: [{
        type: String
    }],
    openAiAssistantId: {
        // id ассистента с платформы openAi
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

const CourseAgent = mongoose.model('CourseAgent', CourseAgentSchema);
export default CourseAgent;