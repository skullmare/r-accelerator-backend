import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { uploadMiddleware, uploadFileController } from '../controllers/file/upload.controller.js';

const router = express.Router();

router.post('/', authMiddleware, uploadMiddleware, uploadFileController);

export default router;
