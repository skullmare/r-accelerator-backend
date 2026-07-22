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
 *       description: Метаданные загруженного файла. Бинарное содержимое лежит в S3, эта запись — только описание файла в MongoDB.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор записи о файле.
 *         name:
 *           type: string
 *           description: Оригинальное имя файла, как оно называлось у пользователя при загрузке.
 *         url:
 *           type: string
 *           format: uri
 *           description: Публичная ссылка на файл в Yandex Cloud S3.
 *         key:
 *           type: string
 *           nullable: true
 *           description: Ключ (путь) объекта внутри S3-бакета. Нужен серверу для повторного скачивания файла при (пере)индексации, самостоятельной ценности для клиента не несёт.
 *         type:
 *           type: string
 *           description: MIME-тип файла — по нему сервер выбирает, можно ли извлечь из файла текст (поддерживаются text/plain, text/markdown, application/pdf, .docx).
 *           example: image/jpeg
 *         size:
 *           type: integer
 *           description: Размер файла в байтах.
 *         uploadedBy:
 *           type: string
 *           description: ID пользователя, загрузившего файл.
 *         source:
 *           type: string
 *           enum: [user, system]
 *           description: Источник файла — загружен пользователем или создан системой. Сейчас все файлы через /file/upload и /file/multipart/complete всегда 'user'.
 *         projectId:
 *           type: string
 *           nullable: true
 *           description: Проект Р-Акселератора, к которому привязан файл. Если задан при загрузке — файл синхронно обрабатывается (извлечение текста + индексация в Qdrant) прямо в запросе загрузки; если null — обычный файл вне экспертного контекста, не обрабатывается.
 *         processingStatus:
 *           type: string
 *           enum: [uploaded, extracting, extracted, indexing, indexed, failed, unsupported]
 *           description: |
 *             Итоговый шаг синхронного пайплайна обработки файла (очереди нет):
 *              * uploaded — загружен, но обработка ещё не запускалась (файл вне проекта);
 *              * extracting — идёт чтение и разбиение файла на текстовые фрагменты;
 *              * indexed — обработка полностью завершена успешно;
 *              * failed — ошибка на любом шаге (см. processingError), можно повторить через /files/{fileId}/index;
 *              * unsupported — формат не поддерживается или файл превысил лимит размера для формата (сейчас 20 МБ для PDF/DOCX).
 *         extractedTextStatus:
 *           type: string
 *           enum: [not_started, success, empty, failed, unsupported]
 *           description: Результат именно шага извлечения текста — отдельно от общего processingStatus, т.к. текст может извлечься успешно, а последующая запись в Qdrant упасть.
 *         qdrantStatus:
 *           type: string
 *           enum: [not_indexed, indexed, failed, stale]
 *           description: Результат именно шага записи в Qdrant.
 *         qdrantPointIds:
 *           type: array
 *           items: { type: string }
 *           description: Id точек, созданных в Qdrant из фрагментов этого файла. Пустой массив, пока файл не проиндексирован.
 *         textHash:
 *           type: string
 *           nullable: true
 *           description: Хэш всего извлечённого текста файла — служебное поле для определения, изменился ли текст при последующей переиндексации.
 *         extractedTextPreview:
 *           type: string
 *           nullable: true
 *           description: Первые ~300 символов извлечённого текста — для превью в интерфейсе, без похода в Qdrant за содержимым.
 *         processingError:
 *           type: string
 *           nullable: true
 *           description: Короткое безопасное описание последней ошибки обработки (без технических деталей/стектрейса) — то, что можно показать пользователю.
 *         processingErrorCode:
 *           type: string
 *           nullable: true
 *           description: Машиночитаемый код последней ошибки обработки (в отличие от processingError — стабильное значение, на него можно свитчиться). Сейчас единственное реальное значение — QDRANT_INDEX_FAILED (текст извлёкся успешно, упала именно запись в Qdrant); для ошибок извлечения текста остаётся null.
 *         indexedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Момент последней успешной индексации файла в Qdrant.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент загрузки файла.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения записи (в т.ч. смены статуса обработки).
 *     FileProcessingStatus:
 *       type: object
 *       description: Краткий статус обработки файла — то, что реально возвращает GET .../files/{fileId}/processing-status (не полная запись File).
 *       properties:
 *         processingStatus:
 *           type: string
 *           enum: [uploaded, extracting, extracted, indexing, indexed, failed, unsupported]
 *           description: См. File.processingStatus.
 *         extractedTextStatus:
 *           type: string
 *           enum: [not_started, success, empty, failed, unsupported]
 *           description: См. File.extractedTextStatus.
 *         qdrantStatus:
 *           type: string
 *           enum: [not_indexed, indexed, failed, stale]
 *           description: См. File.qdrantStatus.
 *         qdrantPointsCount:
 *           type: integer
 *           description: Количество точек, созданных в Qdrant из этого файла (длина File.qdrantPointIds, отдаётся числом, а не списком id).
 *         processingError:
 *           type: string
 *           nullable: true
 *           description: Короткое безопасное описание последней ошибки обработки, если она была.
 *         processingErrorCode:
 *           type: string
 *           nullable: true
 *           description: Машиночитаемый код последней ошибки обработки. Сейчас единственное реальное значение — QDRANT_INDEX_FAILED (текст извлёкся успешно, упала именно запись в Qdrant); для ошибок извлечения текста остаётся null.
 *         indexedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Момент последней успешной индексации в Qdrant.
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
 *               projectId:
 *                 type: string
 *                 description: Опционально — привязать файл к проекту Р-Акселератора. Владение проектом проверяется на сервере. Если указан, запускается асинхронная индексация в Qdrant.
 *     responses:
 *       200:
 *         description: Файл загружен и сохранён в БД
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Файл загружен" }
 *                 data:
 *                   $ref: '#/components/schemas/File'
 *       400:
 *         description: Файл не передан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Фильтр по проекту Р-Акселератора, к которому привязан файл.
 *     responses:
 *       200:
 *         description: Список файлов с пагинацией
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Список файлов получен" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     files:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/File'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Оригинальное имя файла — по расширению из него формируется ключ объекта в S3.
 *                 example: video.mp4
 *               mimetype:
 *                 type: string
 *                 description: MIME-тип загружаемого файла, сохраняется в записи File.
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
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Multipart upload инициирован" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploadId:
 *                       type: string
 *                       description: ID multipart upload в S3
 *                     key:
 *                       type: string
 *                       description: Ключ объекта в S3 (путь к файлу)
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка S3
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Presigned URLs получены" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     urls:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uri
 *                       description: Presigned URLs в том же порядке, что и partNumbers. Действительны 1 час.
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка S3
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: ID multipart upload из шага initiate.
 *               key:
 *                 type: string
 *                 description: Ключ объекта в S3 из шага initiate.
 *               parts:
 *                 type: array
 *                 description: Все загруженные части в порядке возрастания PartNumber, с ETag каждой.
 *                 items:
 *                   $ref: '#/components/schemas/UploadPart'
 *               originalname:
 *                 type: string
 *                 description: Оригинальное имя файла — сохраняется в File.name.
 *                 example: video.mp4
 *               mimetype:
 *                 type: string
 *                 description: MIME-тип файла — сохраняется в File.type.
 *                 example: video/mp4
 *               size:
 *                 type: integer
 *                 description: Размер файла в байтах — сохраняется в File.size.
 *                 example: 2147483648
 *               projectId:
 *                 type: string
 *                 nullable: true
 *                 description: Опционально — привязать файл к проекту Р-Акселератора. Владение проектом проверяется на сервере. Если указан, запускается асинхронная индексация в Qdrant (обработка не блокирует этот запрос).
 *     responses:
 *       200:
 *         description: Файл загружен и сохранён в БД
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Файл успешно загружен" }
 *                 data:
 *                   $ref: '#/components/schemas/File'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Проект не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка S3 или БД
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: ID multipart upload, который нужно отменить.
 *               key:
 *                 type: string
 *                 description: Ключ объекта в S3, связанный с этим upload.
 *     responses:
 *       200:
 *         description: Загрузка отменена, части удалены из S3
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Загрузка отменена" }
 *                 data: { type: object, example: {} }
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Ошибка S3
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/multipart/abort', authMiddleware, validate(fileSchemas.abortUploadSchema), abortUploadController);

export default router;
