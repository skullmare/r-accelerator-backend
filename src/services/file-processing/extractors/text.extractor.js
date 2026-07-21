import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../../../config/s3.config.js';
import { CHUNK_SIZE, CHUNK_OVERLAP, hashText } from '../chunker.js';

const bucket = process.env.S3_BUCKET;

// Streams the object body straight from S3 and yields chunks as soon as
// enough text has accumulated. Memory usage stays bounded by CHUNK_SIZE
// regardless of file size — this is what keeps a multi-hundred-MB TXT/MD
// file from ever being fully buffered in the worker process.
export async function* extractTextChunks(key) {
    const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

    let buffer = '';
    let chunkIndex = 0;

    for await (const part of Body) {
        buffer += part.toString('utf-8');

        while (buffer.length >= CHUNK_SIZE) {
            const chunkContent = buffer.slice(0, CHUNK_SIZE);
            yield { chunkIndex: chunkIndex++, text: chunkContent, textHash: hashText(chunkContent) };
            buffer = buffer.slice(CHUNK_SIZE - CHUNK_OVERLAP);
        }
    }

    if (buffer.trim().length > 0) {
        yield { chunkIndex: chunkIndex++, text: buffer, textHash: hashText(buffer) };
    }
}
