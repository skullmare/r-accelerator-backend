import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../../config/s3.config.js';
import File from '../../models/file.model.js';

const bucket = process.env.S3_BUCKET;

// Определение MIME-типа по расширению URL — запасной вариант, когда сервер
// отдал Content-Type вида application/octet-stream или не отдал его вовсе.
const EXT_TO_MIME = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function mimeFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop()?.toLowerCase();
        return EXT_TO_MIME[ext] || null;
    } catch {
        return null;
    }
}

function normalizeMime(contentType) {
    if (!contentType) return null;
    // "text/plain; charset=utf-8" -> "text/plain"
    return contentType.split(';')[0].trim().toLowerCase();
}

async function streamToBuffer(body) {
    const parts = [];
    for await (const part of body) parts.push(part);
    return Buffer.concat(parts);
}

// Загружает бинарное содержимое источника knowledge в буфер и определяет его
// MIME-тип. Источник — ровно один из двух: fileId (уже загруженный File в
// S3) или sourceUrl (внешняя ссылка). Лимитов на размер нет по требованию.
// Возвращает { buffer, mimeType }. Ошибки скачивания помечаются кодом
// SOURCE_FETCH_FAILED, чтобы вызывающий отличил их от ошибок извлечения.
export async function loadKnowledgeSource({ fileId, sourceUrl }) {
    if (fileId) {
        const file = await File.findById(fileId);
        if (!file) {
            const error = new Error(`File ${fileId} не найден`);
            error.code = 'SOURCE_FETCH_FAILED';
            throw error;
        }
        try {
            const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: file.key }));
            const buffer = await streamToBuffer(Body);
            return { buffer, mimeType: normalizeMime(file.type) };
        } catch (error) {
            if (!error.code) error.code = 'SOURCE_FETCH_FAILED';
            throw error;
        }
    }

    if (sourceUrl) {
        try {
            const response = await fetch(sourceUrl);
            if (!response.ok) {
                const error = new Error(`Не удалось скачать ${sourceUrl}: HTTP ${response.status}`);
                error.code = 'SOURCE_FETCH_FAILED';
                throw error;
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            const mimeType = normalizeMime(response.headers.get('content-type')) || mimeFromUrl(sourceUrl);
            return { buffer, mimeType };
        } catch (error) {
            if (!error.code) error.code = 'SOURCE_FETCH_FAILED';
            throw error;
        }
    }

    const error = new Error('Не задан источник knowledge (fileId или sourceUrl)');
    error.code = 'SOURCE_FETCH_FAILED';
    throw error;
}
