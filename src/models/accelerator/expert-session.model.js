import mongoose from 'mongoose';

const ExpertSessionSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'waiting_user_confirmation', 'completed', 'failed'],
        default: 'active'
    },
    inputContextSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    outputSummary: {
        type: String,
        trim: true,
        default: null
    },
    artifactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artifact',
        default: null
    }
}, {
    timestamps: true
});

ExpertSessionSchema.index({ projectId: 1, agentId: 1, createdAt: -1 });

const ExpertSession = mongoose.model('ExpertSession', ExpertSessionSchema);
export default ExpertSession;
