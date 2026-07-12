import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    port: null,
    https: true,
    checkCompatibility: false, // иначе конструктор бьёт по сети при каждом импорте модуля
});

const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'expert_context';

export { qdrantClient, QDRANT_COLLECTION };