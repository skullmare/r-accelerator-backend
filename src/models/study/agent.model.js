import mongoose from 'mongoose';

// Обучающий агент курсов (домен "study" — отдельный от Р-Акселератора).
// В отличие от accelerator/agent.model.js, этот агент — это конфигурация
// поверх готового OpenAI Assistant, а не самостоятельная сборка промпта
// на своей стороне.
const StudyAgentSchema = new mongoose.Schema({
    // Имя агента для интерфейса.
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Описание агента для списка агентов/каталога программ.
    description: {
        type: String,
        required: true
    },
    // Короткая пометка роли агента — только для отображения.
    role: {
        type: String,
        maxlength: 100,
        default: null
    },
    // URL аватарки агента — используется в UI (в т.ч. в проекции
    // get-progress.controller.js: 'name avatar role').
    avatar: {
        type: String,
        required: true
    },
    // Id ассистента в OpenAI Assistants API — вся логика ответов агента
    // (системный промпт, инструменты и т.д.) настроена на стороне OpenAI,
    // здесь только ссылка. Используется в create-message.controller.js как
    // assistant_id при вызове openai.beta.threads.runs.stream(...)
    // (см. send-message-assistant-stream.js).
    openAiAssistantId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const StudyAgent = mongoose.model('StudyAgent', StudyAgentSchema);
export default StudyAgent;
