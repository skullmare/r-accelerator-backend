import mammoth from 'mammoth';
import { fetchObjectBuffer } from './s3-object.util.js';
import { chunkText } from '../chunker.js';

const MAX_BYTES = 20 * 1024 * 1024; // желательный (не обязательный) формат — ограничиваем худший случай

export async function* extractDocxChunks(key) {
    const buffer = await fetchObjectBuffer(key, MAX_BYTES);
    const { value: text } = await mammoth.extractRawText({ buffer });

    for (const chunk of chunkText(text)) {
        yield chunk;
    }
}
