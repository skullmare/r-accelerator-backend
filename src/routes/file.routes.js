import express from 'express';
import multer from 'multer';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import fileSchemas from '../schemas/file.schema.js';
import { uploadFileController } from '../controllers/file/upload.controller.js';
import { listFiles } from '../controllers/file/list-files.controller.js';

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
 */

/**
 * @swagger
 * /file/upload:
 *   post:
 *     tags: [Files]
 *     summary: Загрузить файл или изображение
 *     description: Загружает файл в Yandex Cloud S3 и сохраняет запись в БД. Максимальный размер — 10 МБ.
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

export default router;
