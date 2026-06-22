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
    openAiAssistantId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const StudyAgent = mongoose.model('StudyAgent', StudyAgentSchema);
export default StudyAgent;