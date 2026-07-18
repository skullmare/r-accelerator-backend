import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../../../config/s3.config.js';

const bucket = process.env.S3_BUCKET;

// Only used by formats whose parser libraries require the full buffer
// (PDF/DOCX). maxBytes bounds worst-case memory/CPU cost for these
// best-effort formats; oversized files come back as 'unsupported' instead
// of risking a long synchronous parse on the worker's event loop.
export async function fetchObjectBuffer(key, maxBytes) {
    const { Body, ContentLength } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

    if (maxBytes && ContentLength && ContentLength > maxBytes) {
        const error = new Error(`Файл превышает лимит ${maxBytes} байт для этого формата`);
        error.code = 'FILE_TOO_LARGE_FOR_FORMAT';
        throw error;
    }

    const parts = [];
    let total = 0;
    for await (const chunk of Body) {
        total += chunk.length;
        if (maxBytes && total > maxBytes) {
            const error = new Error(`Файл превышает лимит ${maxBytes} байт для этого формата`);
            error.code = 'FILE_TOO_LARGE_FOR_FORMAT';
            throw error;
        }
        parts.push(chunk);
    }

    return Buffer.concat(parts);
}
