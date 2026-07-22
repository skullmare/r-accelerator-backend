import mongoose from 'mongoose';

const StudyMessageSchema = new mongoose.Schema({
    // Текст сообщения. create-message.controller.js сохраняет реплику
    // пользователя этим полем, а ответ ассистента — накопленным из стрима
    // OpenAI текстом (fullText/responseText в
    // send-message-assistant-stream.js).
    messageText: {
        type: String,
        required: true
    },
    // Пользователь, участвующий в диалоге (и для user-, и для
    // agent-сообщений — это "с кем говорит агент", не только автор).
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Обучающий агент, с которым идёт диалог.
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyAgent',
        required: true
    },
    // Кто автор конкретного сообщения. При сборке истории для нового
    // OpenAI-треда (resolveThreadId в create-message.controller.js)
    // 'user' мапится в роль 'user', всё остальное — в 'assistant'.
    author: {
        type: String,
        enum: ['agent', 'user'],
        required: true
    }
}, {
    timestamps: true
});

// Используется при подгрузке истории диалога пользователя с конкретным
// агентом (последние 32 сообщения, см. create-message.controller.js).
StudyMessageSchema.index({ user: 1, agent: 1, createdAt: -1 });

const StudyMessage = mongoose.model('StudyMessage', StudyMessageSchema);
export default StudyMessage;
