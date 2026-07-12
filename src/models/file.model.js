import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    source: {
        type: String,
        enum: ['user', 'system'],
        required: true,
        default: 'system'
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    },
    key: {
        type: String,
        default: null
    },
    processingStatus: {
        type: String,
        enum: ['uploaded', 'extracting', 'extracted', 'indexing', 'indexed', 'failed', 'unsupported'],
        default: 'uploaded'
    },
    extractedTextStatus: {
        type: String,
        enum: ['not_started', 'success', 'empty', 'failed', 'unsupported'],
        default: 'not_started'
    },
    qdrantStatus: {
        type: String,
        enum: ['not_indexed', 'indexed', 'failed', 'stale'],
        default: 'not_indexed'
    },
    qdrantPointIds: {
        type: [String],
        default: []
    },
    textHash: {
        type: String,
        default: null
    },
    extractedTextPreview: {
        type: String,
        default: null
    },
    processingError: {
        type: String,
        default: null
    },
    indexedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
})

FileSchema.index({ projectId: 1 });

const File = mongoose.model('File', FileSchema);
export default File;