import mongoose from 'mongoose';

const LessonGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    }
}, {
    timestamps: true
});

const LessonGroup = mongoose.model('LessonGroup', LessonGroupSchema);
export default LessonGroup;
