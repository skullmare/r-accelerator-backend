import OpenAI from "openai";

// Отдельный клиент под OpenRouter — используется ТОЛЬКО для эмбеддингов
// (единый провайдер векторизации для обоих контуров: expert_context и
// knowledge_context). Чат-модели агентов остаются на openai.config.js —
// см. docs/expert-context.md. OpenRouter полностью OpenAI-совместим, поэтому
// достаточно переопределить baseURL и переиспользовать тот же SDK.
//
// Ключ берётся из OPENAI_API_KEY: по продуктовому решению это теперь ключ
// OpenRouter (не OpenAI), см. .env.example.
const openrouter = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'test-key',
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
});

export default openrouter;
