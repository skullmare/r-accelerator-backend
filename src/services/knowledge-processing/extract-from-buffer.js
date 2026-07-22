import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { chunkText } from '../file-processing/chunker.js';

// Buffer-ориентированное извлечение текста для контура knowledge. В отличие
// от проектных экстракторов (file-processing/extractors/*), которые стримят
// объект из S3 по ключу, здесь источник уже загружен в буфер (из S3 по
// fileId ИЛИ по внешней ссылке — см. load-source.js), поэтому извлечение
// работает от буфера и одинаково для обоих источников.
//
// Возвращает массив чанков [{ chunkIndex, text, textHash }] либо null, если
// формат не поддерживается (нет экстрактора под данный MIME-тип).
export async function extractChunksFromBuffer(buffer, mimeType) {
    switch (mimeType) {
        case 'text/plain':
        case 'text/markdown':
        case 'text/x-markdown':
            return chunkText(buffer.toString('utf-8'));

        case 'application/pdf': {
            const parser = new PDFParse({ data: buffer });
            try {
                const { text } = await parser.getText();
                return chunkText(text);
            } finally {
                await parser.destroy();
            }
        }

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
            const { value: text } = await mammoth.extractRawText({ buffer });
            return chunkText(text);
        }

        default:
            return null;
    }
}
