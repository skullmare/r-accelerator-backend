import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    port: null,
    https: true,
});

export { qdrantClient };