import mongoose from 'mongoose';

const CourseGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    agents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseAgent'
    }],
    active: {
        type: Boolean,
        required: true,
        default: true
    }
}, {
    timestamps: true
});

const CourseGroup = mongoose.model('CourseGroup', CourseGroupSchema);
export default CourseGroup;