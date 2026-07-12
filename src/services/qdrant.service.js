import crypto from 'crypto';
import { qdrantClient, QDRANT_COLLECTION } from '../../config/qdrant.config.js';
import { EMBEDDING_DIM } from '../../config/embedding.config.js';
import { embedTexts, embedText } from './embedding.service.js';

// Fixed, arbitrary namespace so point IDs are deterministic across the
// whole app (sourceId + chunkIndex always map to the same point). This is
// what makes re-indexing idempotent: upserting the same source overwrites
// the same points instead of creating duplicates (NFR-4).
// Standard RFC 4122 UUID v5 (SHA-1 based), implemented directly on top of
// Node's crypto module so we don't depend on the `uuid` package (whose
// ESM-only build doesn't play well with this project's Jest/Babel setup).
const POINT_NAMESPACE = Buffer.from('5f2f3e2a6b1a4b0a9a6a2f6a1b7c9d10', 'hex');

function uuidV5(name) {
    const hash = crypto.createHash('sha1')
        .update(Buffer.concat([POINT_NAMESPACE, Buffer.from(name, 'utf8')]))
        .digest();

    const bytes = Buffer.from(hash.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pointId(sourceId, chunkIndex) {
    return uuidV5(`${sourceId}:${chunkIndex}`);
}

let collectionEnsured = false;

export async function ensureCollection() {
    if (collectionEnsured) return;

    const { collections } = await qdrantClient.getCollections();
    const exists = collections.some((c) => c.name === QDRANT_COLLECTION);

    if (!exists) {
        await qdrantClient.createCollection(QDRANT_COLLECTION, {
            vectors: { size: EMBEDDING_DIM, distance: 'Cosine' }
        });
    }

    collectionEnsured = true;
}

// chunks: [{ chunkIndex, text, textHash }]
export async function upsertChunks({ projectId, agentCode = null, sourceType, sourceId, chunks, visibility = 'private_project' }) {
    if (!projectId) throw new Error('projectId обязателен для индексации в Qdrant');
    if (chunks.length === 0) return [];

    await ensureCollection();

    const vectors = await embedTexts(chunks.map((chunk) => chunk.text));
    const createdAt = new Date().toISOString();

    const points = chunks.map((chunk, i) => ({
        id: pointId(sourceId, chunk.chunkIndex),
        vector: vectors[i],
        payload: {
            projectId: String(projectId),
            agentCode: agentCode ?? null,
            sourceType,
            sourceId: String(sourceId),
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            textHash: chunk.textHash,
            createdAt,
            visibility
        }
    }));

    await qdrantClient.upsert(QDRANT_COLLECTION, { wait: true, points });

    return points.map((p) => p.id);
}

export async function deleteBySource(sourceId) {
    await ensureCollection();
    await qdrantClient.delete(QDRANT_COLLECTION, {
        wait: true,
        filter: { must: [{ key: 'sourceId', match: { value: String(sourceId) } }] }
    });
}

export async function deleteByProject(projectId) {
    await ensureCollection();
    await qdrantClient.delete(QDRANT_COLLECTION, {
        wait: true,
        filter: { must: [{ key: 'projectId', match: { value: String(projectId) } }] }
    });
}

// Search always requires projectId — this is the enforcement point for
// SEC-6 / QDR-3 (no cross-project leakage into an LLM prompt).
export async function searchContext({ projectId, sourceTypes, queryText, topK = 6 }) {
    if (!projectId) throw new Error('projectId обязателен для поиска в Qdrant');

    await ensureCollection();

    const vector = await embedText(queryText);
    const must = [{ key: 'projectId', match: { value: String(projectId) } }];
    if (sourceTypes?.length) {
        must.push({ key: 'sourceType', match: { any: sourceTypes } });
    }

    const results = await qdrantClient.search(QDRANT_COLLECTION, {
        vector,
        limit: topK,
        filter: { must },
        with_payload: true
    });

    return results.map((r) => ({ score: r.score, payload: r.payload }));
}
