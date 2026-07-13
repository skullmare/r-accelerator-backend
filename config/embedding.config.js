const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 1536);

export { EMBEDDING_MODEL, EMBEDDING_DIM };
