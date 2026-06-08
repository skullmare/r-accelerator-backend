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
    }
}, {
    timestamps: true
})

const File = mongoose.model('File', FileSchema);
export default File;