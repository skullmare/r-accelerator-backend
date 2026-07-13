import openai from '../../config/openai.config.js';
import { EMBEDDING_MODEL } from '../../config/embedding.config.js';

export async function embedTexts(texts) {
    if (texts.length === 0) return [];

    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts
    });

    return response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
}

export async function embedText(text) {
    const [vector] = await embedTexts([text]);
    return vector;
}
