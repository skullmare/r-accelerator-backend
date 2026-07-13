import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    // Логин пользователя и единственный способ входа — авторизация
    // беспарольная, по коду на email (см. authCodeHashed ниже).
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Пожалуйста, введите корректный email']
    },
    // Ссылка на роль — checkPermission.middleware.js подтягивает
    // user.role.permissions, чтобы проверить права на конкретное действие.
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    profession: {
        type: String
    },
    fieldOfActivity: {
        type: String
    },
    city: {
        type: String
    },
    // Программы обучения, к которым присоединился пользователь. Пополняется
    // через $addToSet в join-program.controller.js (по qrCode программы);
    // check-access-program.middleware.js проверяет присутствие programId
    // здесь, чтобы пустить/не пустить на защищённые маршруты программы.
    studyPrograms: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyProgram'
    }],
    // Id треда в OpenAI Assistants API — привязывает пользователя к его
    // истории диалога с обучающими агентами. Заводится и обновляется в
    // create-message.controller.js: если у старого треда идёт активный run,
    // resolveThreadId создаёт новый тред (с историей сообщений) и
    // перезаписывает это поле.
    openAiThreadId: {
        type: String
    },
    // Захешированный (bcrypt) одноразовый код авторизации. select:false —
    // никогда не возвращается в обычных ответах API, читается только явным
    // проекцией ('+authCodeHashed' и т.п.) в auth-контроллерах.
    authCodeHashed: {
        type: String,
        required: false,
        default: null,
        select: false
    },
    // Момент истечения текущего кода (выдаётся на CODE_TTL_MS = 15 минут,
    // см. auth.constants.js). verify-code.controller.js отклоняет попытку
    // входа, если код истёк.
    authCodeExpires: {
        type: Date,
        required: false,
        default: null,
        select: false
    },
    // Счётчик неудачных попыток ввода кода для текущего code-сеанса.
    // Инкрементируется в verify-code.controller.js при неверном коде;
    // при достижении MAX_ATTEMPTS (3) дальнейшие попытки отклоняются 429,
    // пока не запросят новый код.
    authCodeAttempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 3,
        select: false
    },
    // Момент последнего успешного входа — проставляется в
    // verify-code.controller.js при успешной проверке кода.
    lastLogin: {
        type: Date
    },
    // Помечает служебных пользователей (сейчас — единственный суперадмин,
    // создаваемый init/superadmin.init.js). Такого пользователя нельзя
    // отредактировать или сменить ему роль (update-user*.controller.js
    // явно проверяют этот флаг и отклоняют операцию).
    isSystem: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);
export default User;
