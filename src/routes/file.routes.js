import express from 'express';
import multer from 'multer';
import authMiddleware from '../middlewares/auth.middleware.js';
import { uploadFileController } from '../controllers/file/upload.controller.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});
const router = express.Router();

router.post('/upload', authMiddleware, upload.single('file'), uploadFileController);

export default router;
