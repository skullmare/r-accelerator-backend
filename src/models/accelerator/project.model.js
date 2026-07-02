import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: null
    },
    userRole: {
        type: String,
        trim: true,
        default: null
    },
    industry: {
        type: String,
        trim: true,
        default: null
    },
    businessSpecifics: {
        type: String,
        trim: true,
        default: null
    },
    stage: {
        type: String,
        enum: ['idea', 'mvp', 'launched', 'growth', 'scale'],
        default: 'idea'
    },
    goal: {
        type: String,
        trim: true,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'archived'],
        default: 'active'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

ProjectSchema.index({ ownerId: 1 });

const Project = mongoose.model('Project', ProjectSchema);
export default Project;
