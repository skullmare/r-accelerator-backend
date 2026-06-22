import {
    PutObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export function generateKey(originalname) {
    const ext = originalname.split('.').pop();
    return `${crypto.randomUUID()}.${ext}`;
}

export function buildUrl(key) {
    return `${baseUrl}/${bucket}/${key}`;
}

export async function createMultipartUpload({ key, mimetype }) {
    const { UploadId } = await s3Client.send(new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: mimetype,
    }));
    return UploadId;
}

export async function getPresignedPartUrls({ key, uploadId, partNumbers }) {
    return Promise.all(
        partNumbers.map(partNumber =>
            getSignedUrl(
                s3Client,
                new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
                { expiresIn: 3600 }
            )
        )
    );
}

export async function completeMultipartUpload({ key, uploadId, parts }) {
    await s3Client.send(new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
    }));
    return buildUrl(key);
}

export async function abortMultipartUpload({ key, uploadId }) {
    await s3Client.send(new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
    }));
}
