import { S3Client } from "@aws-sdk/client-s3";

// Generic S3-compatible client — не завязан на конкретного провайдера.
// Сейчас в .env настроен Timeweb Cloud (endpoint https://s3.twcstorage.ru,
// region ru-1, forcePathStyle обязателен — Timeweb, как и большинство
// не-AWS S3-совместимых хранилищ, не поддерживает virtual-hosted-style
// адресацию бакетов). Смена провайдера — это смена значений в .env, без
// правок кода.
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }
});

export { s3Client };