import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    port: null,
    https: true,
    checkCompatibility: false, // иначе конструктор бьёт по сети при каждом импорте модуля
});

// Коллекция приватного проектного контекста (файлы проекта + артефакты
// этапов), фильтруется по projectId — см. docs/expert-context.md.
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'expert_context';

// Коллекция глобальной базы знаний (сущность Knowledge), фильтруется по
// knowledgeId. Отдельная от проектного контекста: разные источники, разная
// модель безопасности (глобальные знания vs приватные данные проекта).
const QDRANT_KNOWLEDGE_COLLECTION = process.env.QDRANT_KNOWLEDGE_COLLECTION || 'knowledge_context';

export { qdrantClient, QDRANT_COLLECTION, QDRANT_KNOWLEDGE_COLLECTION };
