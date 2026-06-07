import mongoose from 'mongoose';

const StudyProgramSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    modules: [{}],
    agents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyAgent'
    }],
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