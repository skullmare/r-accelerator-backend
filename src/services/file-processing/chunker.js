import crypto from 'crypto';

export const CHUNK_SIZE = 1500;
export const CHUNK_OVERLAP = 200;

export function hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// Char-based sliding window chunking (an approximation of token-based
// chunking, explicitly allowed by the spec's maxContextChars option).
// Used for formats that require the full text in memory (PDF/DOCX).
// Text formats are chunked incrementally instead — see text.extractor.js.
export function chunkText(text, { maxChars = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return [];

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < trimmed.length) {
        const end = Math.min(start + maxChars, trimmed.length);
        const chunkContent = trimmed.slice(start, end);
        chunks.push({ chunkIndex: chunkIndex++, text: chunkContent, textHash: hashText(chunkContent) });
        if (end === trimmed.length) break;
        start = end - overlap;
    }

    return chunks;
}
