import mongoose from 'mongoose';

const ModuleItemSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['lesson', 'agent'],
        required: true
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'type'
    }
});

const ModuleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    items: [ModuleItemSchema]
});

const StudyProgramSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    modules: [ModuleSchema],
    sequential: {
        type: Boolean,
        default: true,
        required: true
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    qrCode: {
        type: String,
        required: true,
        unique: true,
    }
}, {
    timestamps: true
});

const StudyProgram = mongoose.model('StudyProgram', StudyProgramSchema);
export default StudyProgram;