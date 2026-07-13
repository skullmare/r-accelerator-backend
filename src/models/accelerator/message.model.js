import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    // Сессия, которой принадлежит сообщение. По этому полю собирается
    // история диалога (getSessionHistory), которая уходит в LLM вместе с
    // системным промптом при каждом новом сообщении.
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpertSession',
        required: true
    },
    // Дублирует projectId сессии — денормализация ради того, чтобы не
    // джойнить ExpertSession всякий раз, когда нужно отфильтровать
    // сообщения по проекту.
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    // Кто автор сообщения. user/assistant участвуют в истории, которая
    // передаётся модели (senderType маппится в role: 'user'|'assistant'
    // при сборке messages для chatComplete); system зарезервирован на
    // будущее (например, служебные пометки в диалоге), сейчас нигде не
    // создаётся автоматически.
    senderType: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    // Текст сообщения — то, что реально видел пользователь/модель.
    content: {
        type: String,
        required: true,
        maxlength: 20000
    },
    // Статистика по токенам от провайдера LLM (если он её возвращает) —
    // сохраняется только для ассистентских сообщений, для аудита
    // расходов. Ни на что в логике не влияет.
    tokenUsage: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

// Используется при подгрузке истории диалога в хронологическом порядке
// (getSessionHistory ограничивает её последними 30 сообщениями).
MessageSchema.index({ sessionId: 1, createdAt: 1 });

const Message = mongoose.model('Message', MessageSchema);
export default Message;
