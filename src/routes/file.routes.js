import express from 'express';
import multer from 'multer';
import authMiddleware from '../middlewares/auth.middleware.js';
import { uploadFileController } from '../controllers/file/upload.controller.js';

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

export default router;
