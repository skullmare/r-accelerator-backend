import { PDFParse } from 'pdf-parse';
import { fetchObjectBuffer } from './s3-object.util.js';
import { chunkText } from '../chunker.js';

const MAX_BYTES = 20 * 1024 * 1024; // желательный (не обязательный) формат — ограничиваем худший случай

export async function* extractPdfChunks(key) {
    const buffer = await fetchObjectBuffer(key, MAX_BYTES);

    const parser = new PDFParse({ data: buffer });
    try {
        const { text } = await parser.getText();
        for (const chunk of chunkText(text)) {
            yield chunk;
        }
    } finally {
        await parser.destroy();
    }
}
