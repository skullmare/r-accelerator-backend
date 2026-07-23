import openrouter from '../../config/openrouter.config.js';
import { EMBEDDING_MODEL, EMBEDDING_DIM } from '../../config/embedding.config.js';

// Единая точка векторизации для обоих контуров (expert_context и
// knowledge_context). Провайдер — OpenRouter (config/openrouter.config.js),
// модель — google/gemini-embedding-2. Размерность вектора запрашивается явно
// через `dimensions`, чтобы совпадать с размерностью коллекции в Qdrant.

// Формирует понятную ошибку с кодом EMBEDDING_PROVIDER_FAILED вместо
// «Cannot read properties of undefined (reading 'sort')», когда OpenRouter
// вернул ответ не в OpenAI-форме `{ data: [...] }` (обычно это тело ошибки:
// неверный slug модели, неподдерживаемый `dimensions`, эмбеддинги не
// включены для аккаунта). Прокидывает реальное сообщение провайдера, чтобы
// сбой был диагностируемым и в логах, и в SSE-событии error.
function extractProviderError(response) {
    return response?.error?.message
        || response?.error?.metadata?.raw
        || (typeof response?.error === 'string' ? response.error : null)
        || (() => { try { return JSON.stringify(response)?.slice(0, 300); } catch { return null; } })();
}

export async function embedTexts(texts) {
    if (texts.length === 0) return [];

    let response;
    try {
        response = await openrouter.embeddings.create({
            model: EMBEDDING_MODEL,
            input: texts,
            dimensions: EMBEDDING_DIM,
            // Явно float: свежие версии OpenAI SDK по умолчанию шлют
            // encoding_format: 'base64', а Google-эмбеддинги (Gemini) через
            // OpenRouter это не поддерживают и отдают ошибку. См. также, что
            // .map ниже ждёт массив чисел (float), а не base64-строку.
            encoding_format: 'float'
        });
    } catch (error) {
        // Сетевые/HTTP-ошибки SDK (4xx/5xx) — нормализуем код, сохраняя текст.
        error.code = error.code || 'EMBEDDING_PROVIDER_FAILED';
        throw error;
    }

    if (!response || !Array.isArray(response.data)) {
        const error = new Error(
            `Провайдер эмбеддингов (${EMBEDDING_MODEL}) вернул ответ без массива data. ` +
            `Ответ: ${extractProviderError(response) ?? 'неизвестный формат'}`
        );
        error.code = 'EMBEDDING_PROVIDER_FAILED';
        throw error;
    }

    return response.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
}

export async function embedText(text) {
    const [vector] = await embedTexts([text]);
    return vector;
}
