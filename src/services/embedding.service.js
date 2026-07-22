import openrouter from '../../config/openrouter.config.js';
import { EMBEDDING_MODEL, EMBEDDING_DIM } from '../../config/embedding.config.js';

// Единая точка векторизации для обоих контуров (expert_context и
// knowledge_context). Провайдер — OpenRouter (config/openrouter.config.js),
// модель — google/gemini-embedding-2. Размерность вектора запрашивается явно
// через `dimensions`, чтобы совпадать с размерностью коллекции в Qdrant.
export async function embedTexts(texts) {
    if (texts.length === 0) return [];

    const response = await openrouter.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIM
    });

    return response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
}

export async function embedText(text) {
    const [vector] = await embedTexts([text]);
    return vector;
}
