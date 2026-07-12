import mongoose from 'mongoose';

const ArtifactSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    expertSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpertSession',
        required: true
    },
    agentCode: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    summary: {
        type: String,
        required: true,
        maxlength: 4000
    },
    status: {
        type: String,
        enum: ['draft', 'ready', 'confirmed', 'rejected'],
        default: 'draft'
    }
}, {
    timestamps: true
});

ArtifactSchema.index({ projectId: 1, agentCode: 1 });

const Artifact = mongoose.model('Artifact', ArtifactSchema);
export default Artifact;
