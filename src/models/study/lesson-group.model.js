import mongoose from 'mongoose';

// Группа уроков — чисто организационная сущность для группировки
// StudyLesson в UI (см. StudyLesson.group ниже). Собственной логики
// доступа/прогресса не несёт.
const LessonGroupSchema = new mongoose.Schema({
    // Название группы, отображается в списке уроков.
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
