// Единый провайдер эмбеддингов для всего приложения — OpenRouter
// (см. config/openrouter.config.js). Модель google/gemini-embedding-2
// поддерживает настраиваемую размерность вектора (128/768/1536/3072);
// берём максимальную (3072) — приоритет точности над стоимостью/скоростью.
//
// ВАЖНО: EMBEDDING_DIM должен совпадать с размерностью, под которую создана
// коллекция в Qdrant. При смене модели/размерности коллекции нужно пересоздать
// (dropCollection + ensureCollection) — векторы разной размерности в одной
// коллекции хранить нельзя.
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'google/gemini-embedding-2';
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 3072);

export { EMBEDDING_MODEL, EMBEDDING_DIM };
