/**
 * Нагрузочный тест: File upload & listing endpoints
 *
 * Тестирует:
 *   GET  /api/v1/file              — список файлов (с пагинацией)
 *   POST /api/v1/file/upload       — загрузка файла (до 10 МБ)
 *   POST /api/v1/file/multipart/initiate  — старт multipart
 *   POST /api/v1/file/multipart/abort     — отмена multipart
 *
 * Примечание: полный multipart flow требует загрузки части напрямую на S3
 * через presigned URL, что выходит за рамки стандартного k6 теста.
 * Здесь тестируется только инициализация и отмена.
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          k6/scenarios/files.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{endpoint:list_files}': ['p(95)<800'],
    'http_req_duration{endpoint:upload_file}': ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

// Генерирует небольшой PNG-файл (1×1 пиксель) в виде бинарного содержимого
function tinyPngBytes() {
  // 1x1 прозрачный PNG (67 байт)
  const bytes = [
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
    0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
    0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
    0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,
    0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
    0x00,0x00,0x02,0x00,0x01,0xe2,0x21,0xbc,
    0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
    0x44,0xae,0x42,0x60,0x82,
  ];
  return new Uint8Array(bytes).buffer;
}

export function setup() {
  const cookies = authenticate();
  if (!cookies) throw new Error('Аутентификация не удалась');
  return { cookies };
}

export default function ({ cookies }) {
  const params = authParams(cookies);

  group('Files — list', () => {
    // Все файлы
    const res = http.get(
      `${BASE_URL}/api/v1/file?page=1&limit=10`,
      { ...params, tags: { endpoint: 'list_files' } }
    );
    check(res, {
      'files list: статус 200': (r) => r.status === 200,
    });

    sleep(0.3);

    // Фильтр по source=user
    const userRes = http.get(
      `${BASE_URL}/api/v1/file?page=1&limit=10&source=user`,
      { ...params, tags: { endpoint: 'list_files' } }
    );
    check(userRes, {
      'files list (user): статус 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  group('Files — single upload', () => {
    const fileData = http.file(tinyPngBytes(), 'k6-test.png', 'image/png');
    const formData = { file: fileData };

    // Для multipart/form-data убираем Content-Type — k6 выставит его автоматически
    const uploadParams = {
      headers: {
        Cookie: params.headers.Cookie,
      },
      tags: { endpoint: 'upload_file' },
    };

    const res = http.post(
      `${BASE_URL}/api/v1/file/upload`,
      formData,
      uploadParams
    );

    check(res, {
      'file upload: статус 200 или 201': (r) => [200, 201].includes(r.status),
      'file upload: есть url в ответе': (r) => {
        try { return !!JSON.parse(r.body).url; }
        catch { return false; }
      },
    });
  });

  sleep(0.5);

  group('Files — multipart initiate & abort', () => {
    // Инициализация multipart загрузки
    const initiateRes = http.post(
      `${BASE_URL}/api/v1/file/multipart/initiate`,
      JSON.stringify({
        filename: 'k6-large-file.mp4',
        mimetype: 'video/mp4',
        size: 50 * 1024 * 1024, // 50 МБ
      }),
      { ...params, tags: { endpoint: 'multipart_initiate' } }
    );

    check(initiateRes, {
      'multipart initiate: статус 200': (r) => r.status === 200,
      'multipart initiate: есть uploadId': (r) => {
        try { return !!JSON.parse(r.body).uploadId; }
        catch { return false; }
      },
    });

    let uploadId = null;
    let key = null;
    try {
      const body = JSON.parse(initiateRes.body);
      uploadId = body.uploadId;
      key = body.key;
    } catch {}

    sleep(0.3);

    if (uploadId && key) {
      // Отмена multipart (чтобы не засорять S3)
      const abortRes = http.post(
        `${BASE_URL}/api/v1/file/multipart/abort`,
        JSON.stringify({ uploadId, key }),
        { ...params, tags: { endpoint: 'multipart_abort' } }
      );
      check(abortRes, {
        'multipart abort: статус 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1);
}
