import mongoose from 'mongoose';

const StudyProgressSchema = new mongoose.Schema({
    // Пользователь, чей прогресс отслеживается.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Программа, по которой идёт прогресс. Пара (user, program) уникальна
    // (см. индекс ниже) — у пользователя один документ прогресса на
    // программу, а не по документу на каждый пройденный элемент.
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyProgram', required: true },
    // Id пройденных уроков/агентов (StudyLesson._id или StudyAgent._id,
    // без строгой типизации ссылки). Пополняется через $addToSet в
    // complete-lesson.controller.js и complete-agent.controller.js.
    // get-progress.controller.js строит из этого массива Set и считает
    // accessible для каждого элемента модуля: если программа sequential —
    // элемент доступен, только когда предыдущий в этом списке есть.
    completedItems: [{ type: mongoose.Schema.Types.ObjectId }]
}, { timestamps: true });

// Гарантирует не более одного документа прогресса на пару
// пользователь+программа, и по нему же идёт быстрый lookup при каждом
// обращении к прогрессу/разблокировке.
StudyProgressSchema.index({ user: 1, program: 1 }, { unique: true });

const StudyProgress = mongoose.model('StudyProgress', StudyProgressSchema);
export default StudyProgress;
