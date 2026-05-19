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
 * /file/upload:
 *   post:
 *     tags: [Files]
 *     summary: Загрузить файл или изображение
 *     description: Загружает файл в Yandex Cloud S3. Максимальный размер — 10 МБ.
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
 *         description: Файл загружен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   example: "https://storage.yandexcloud.net/bucket/uuid.jpg"
 *       400:
 *         description: Файл не передан
 */
router.post('/upload', authMiddleware, upload.single('file'), uploadFileController);

export default router;
