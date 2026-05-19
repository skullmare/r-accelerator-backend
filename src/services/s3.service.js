import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { s3Client } from '../../config/s3.config.js';

const bucket = process.env.YANDEX_BUCKET;
const baseUrl = 'https://storage.yandexcloud.net';

export async function uploadFile({ buffer, mimetype, originalname }) {
    const ext = originalname.split('.').pop();
    const key = `${crypto.randomUUID()}.${ext}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype
    }));

    return `${baseUrl}/${bucket}/${key}`;
}
