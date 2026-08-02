import mongoose from 'mongoose';

// Агент Акселератора — минимальный набор полей, которого достаточно, чтобы
// провести пользователя через этап: два промпта, список знаний, четыре
// отображаемых поля и два системных.
//
// Всё, что раньше настраивалось у агента (modelConfig, contextPolicy,
// artifactDefinition с JSON-схемой, allowPartialCompletion, isActive,
// greeting, completionEvaluatorPrompt), удалено намеренно: поведение агента
// должно определяться его промптом, а не десятком флагов, о влиянии которых
// приходилось догадываться. Технические параметры LLM и контекста —
// одинаковы для всех агентов и живут в config/accelerator.config.js.
const AgentSchema = new mongoose.Schema({
    // === Промпты: единственное, что управляет поведением агента ===

    // Основная инструкция роли. Уходит в LLM первым блоком системного
    // промпта при каждом сообщении и при генерации документа этапа.
    systemPrompt: {
        type: String,
        required: true,
        maxlength: 20000
    },
    // Условие завершения этапа — обычный текст, а не схема. Показывается
    // агенту в системном промпте на каждом ходу; когда условие выполнено,
    // агент сам вызывает инструмент stage_ready, и фронт получает право
    // показать кнопку «сформировать документ» (см.
    // src/services/accelerator/data-collection.service.js).
    completionPrompt: {
        type: String,
        required: true,
        maxlength: 5000
    },

    // === Знания ===

    // Базы знаний (Knowledge), закреплённые за агентом. Поиск в
    // knowledge_context идёт только по ним: пустой список = агент работает
    // без базы знаний.
    knowledgeIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Knowledge' }],
        default: []
    },

    // === Поля для фронтенда (в промпт не подмешиваются) ===

    // Имя агента («Роман»).
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    // Описание специализации («Эксперт по рынку и нише»).
    description: {
        type: String,
        trim: true,
        default: null,
        maxlength: 1000
    },
    // Обычная аватарка и аватарка «агент думает» (пока модель формирует
    // ответ). Фронт загружает картинки в хранилище и присылает сюда URL.
    avatarUrl: {
        type: String,
        trim: true,
        default: null,
        maxlength: 2000
    },
    thinkingAvatarUrl: {
        type: String,
        trim: true,
        default: null,
        maxlength: 2000
    },

    // === Системные поля маршрута ===

    // Порядковый номер агента. Маршрут пользователя — это агенты,
    // отсортированные по order: первый агент проекта и переход «дальше»
    // считаются по нему.
    order: {
        type: Number,
        required: true
    },
    // Необязательное переопределение перехода: если задан — после
    // завершения этапа проект переключается именно на этого агента, а не на
    // следующего по order. Нужен только для нелинейных маршрутов; для
    // обычного линейного достаточно order.
    nextAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        default: null
    }
}, {
    timestamps: true
});

AgentSchema.index({ order: 1 });

const Agent = mongoose.model('Agent', AgentSchema);
export default Agent;
