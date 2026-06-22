import express from 'express';
import multer from 'multer';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import fileSchemas from '../schemas/file.schema.js';
import { uploadFileController } from '../controllers/file/upload.controller.js';
import { listFiles } from '../controllers/file/list-files.controller.js';
import { initiateUploadController } from '../controllers/file/initiate-upload.controller.js';
import { presignUploadController } from '../controllers/file/presign-upload.controller.js';
import { completeUploadController } from '../controllers/file/complete-upload.controller.js';
import { abortUploadController } from '../controllers/file/abort-upload.controller.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     File:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           description: Оригинальное имя файла
 *         url:
 *           type: string
 *           format: uri
 *           description: Публичная ссылка в S3
 *         type:
 *           type: string
 *           description: MIME-тип файла
 *           example: image/jpeg
 *         size:
 *           type: integer
 *           description: Размер файла в байтах
 *         uploadedBy:
 *           type: string
 *           description: ID пользователя, загрузившего файл
 *         source:
 *           type: string
 *           enum: [user, system]
 *           description: Источник файла — загружен пользователем или создан системой
 *         createdAt:
 *           type: string
 *           format: date-time
 *     UploadPart:
 *       type: object
 *       required: [PartNumber, ETag]
 *       properties:
 *         PartNumber:
 *           type: integer
 *           minimum: 1
 *           description: Номер части (порядковый, начиная с 1)
 *         ETag:
 *           type: string
 *           description: ETag из заголовка ответа S3 после загрузки части
 */

/**
 * @swagger
 * /file/upload:
 *   post:
 *     tags: [Files]
 *     summary: Загрузить небольшой файл (до 10 МБ)
 *     description: Загружает файл через сервер в Yandex Cloud S3 и сохраняет запись в БД. Для файлов крупнее 10 МБ используйте multipart-загрузку через `/file/multipart/*`.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Файл загружен и сохранён в БД
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/File'
 *       400:
 *         description: Файл не передан
 *       401:
 *         description: Не авторизован
 */
router.post('/upload', authMiddleware, upload.single('file'), uploadFileController);

/**
 * @swagger
 * /file:
 *   get:
 *     tags: [Files]
 *     summary: Список файлов текущего пользователя
 *     description: Возвращает файлы, привязанные к текущему пользователю. Поддерживает фильтрацию по source и пагинацию.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [user, system]
 *         description: Фильтр по источнику файла
 *     responses:
 *       200:
 *         description: Список файлов с пагинацией
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Не авторизован
 */
router.get('/', authMiddleware, validate(fileSchemas.listFilesSchema), listFiles);

/**
 * @swagger
 * /file/multipart/initiate:
 *   post:
 *     tags: [Files — Multipart Upload]
 *     summary: Шаг 1 — Инициировать multipart upload
 *     description: |
 *       Создаёт multipart upload в S3 и возвращает `uploadId` и `key`.
 *       Сохраните их на клиенте — они понадобятся на следующих шагах.
 *
 *       **Алгоритм загрузки большого файла:**
 *       1. `POST /file/multipart/initiate` → получить `uploadId`, `key`
 *       2. `POST /file/multipart/presign` → получить presigned URLs для каждой части
 *       3. Загрузить каждую часть напрямую в S3 через `PUT <presignedUrl>`, сохранить `ETag` из ответа
 *       4. `POST /file/multipart/complete` → подтвердить загрузку, получить запись файла в БД
 *       5. При ошибке — `POST /file/multipart/abort` для очистки незавершённого upload
 *
 *       Рекомендуемый размер части: **100 МБ**. Минимум по ограничениям S3 — 5 МБ (кроме последней части).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [filename, mimetype, size]
 *             properties:
 *               filename:
 *                 type: string
 *                 example: video.mp4
 *               mimetype:
 *                 type: string
 *                 example: video/mp4
 *               size:
 *                 type: integer
 *                 description: Размер файла в байтах
 *                 example: 2147483648
 *     responses:
 *       200:
 *         description: Upload инициирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: string
 *                   description: ID multipart upload в S3
 *                 key:
 *                   type: string
 *                   description: Ключ объекта в S3 (путь к файлу)
 *       401:
 *         description: Не авторизован
 *       500:
 *         description: Ошибка S3
 */
router.post('/multipart/initiate', authMiddleware, validate(fileSchemas.initiateUploadSchema), initiateUploadController);

/**
 * @swagger
 * /file/multipart/presign:
 *   post:
 *     tags: [Files — Multipart Upload]
 *     summary: Шаг 2 — Получить presigned URLs для частей
 *     description: |
 *       Возвращает список presigned URLs — по одному на каждый номер части.
 *       Клиент загружает каждую часть напрямую в S3 через `PUT <url>`.
 *
 *       После каждого `PUT` сохраните заголовок `ETag` из ответа S3 —
 *       он понадобится на шаге `/complete`.
 *
 *       Можно запрашивать URL порциями (например, по 10 частей за раз)
 *       и переиспользовать `uploadId`/`key` для каждого вызова.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uploadId, key, partNumbers]
 *             properties:
 *               uploadId:
 *                 type: string
 *                 description: ID из шага initiate
 *               key:
 *                 type: string
 *                 description: Ключ из шага initiate
 *               partNumbers:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 10000
 *                 example: [1, 2, 3]
 *                 description: Номера частей, для которых нужны presigned URLs
 *     responses:
 *       200:
 *         description: Список presigned URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uri
 *                   description: Presigned URLs в том же порядке, что и partNumbers. Действительны 1 час.
 *       401:
 *         description: Не авторизован
 *       500:
 *         description: Ошибка S3
 */
router.post('/multipart/presign', authMiddleware, validate(fileSchemas.presignUploadSchema), presignUploadController);

/**
 * @swagger
 * /file/multipart/complete:
 *   post:
 *     tags: [Files — Multipart Upload]
 *     summary: Шаг 3 — Завершить загрузку и сохранить файл в БД
 *     description: |
 *       Сообщает S3 о завершении multipart upload, после чего сохраняет
 *       запись файла в базе данных и возвращает её.
 *
 *       Массив `parts` должен содержать **все** части в порядке возрастания `PartNumber`,
 *       каждая с `ETag`, полученным при загрузке.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uploadId, key, parts, originalname, mimetype, size]
 *             properties:
 *               uploadId:
 *                 type: string
 *               key:
 *                 type: string
 *               parts:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/UploadPart'
 *               originalname:
 *                 type: string
 *                 example: video.mp4
 *               mimetype:
 *                 type: string
 *                 example: video/mp4
 *               size:
 *                 type: integer
 *                 example: 2147483648
 *     responses:
 *       200:
 *         description: Файл загружен и сохранён в БД
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/File'
 *       401:
 *         description: Не авторизован
 *       500:
 *         description: Ошибка S3 или БД
 */
router.post('/multipart/complete', authMiddleware, validate(fileSchemas.completeUploadSchema), completeUploadController);

/**
 * @swagger
 * /file/multipart/abort:
 *   post:
 *     tags: [Files — Multipart Upload]
 *     summary: Отменить незавершённый multipart upload
 *     description: |
 *       Очищает незавершённый multipart upload в S3.
 *       Вызывайте при ошибке или отмене загрузки на стороне клиента,
 *       чтобы не оставлять «мусор» в хранилище (незавершённые parts тарифицируются).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uploadId, key]
 *             properties:
 *               uploadId:
 *                 type: string
 *               key:
 *                 type: string
 *     responses:
 *       200:
 *         description: Загрузка отменена, части удалены из S3
 *       401:
 *         description: Не авторизован
 *       500:
 *         description: Ошибка S3
 */
router.post('/multipart/abort', authMiddleware, validate(fileSchemas.abortUploadSchema), abortUploadController);

export default router;
