import OpenAI from "openai";

// Отдельный клиент под OpenRouter — используется ТОЛЬКО для эмбеддингов
// (единый провайдер векторизации для обоих контуров: expert_context и
// knowledge_context). Чат-модели агентов остаются на openai.config.js —
// см. docs/expert-context.md. OpenRouter полностью OpenAI-совместим, поэтому
// достаточно переопределить baseURL и переиспользовать тот же SDK.
//
// Ключ: приоритет у OPENROUTER_API_KEY, иначе fallback на OPENAI_API_KEY.
// Так эмбеддинги (OpenRouter) и чат агентов (прямой OpenAI, openai.config.js)
// могут использовать РАЗНЫЕ ключи — один и тот же ключ не пройдёт авторизацию
// у обоих провайдеров сразу. Если задан только OPENAI_API_KEY, он идёт и сюда
// (обратная совместимость с прежним поведением).
const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || 'test-key',
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
});

export default openrouter;
