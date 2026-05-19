import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import profileSchemas from '../schemas/profile.schema.js';
import { getProfile } from '../controllers/profile/get-profile.controller.js';
import { updateProfile } from '../controllers/profile/update-profile.controller.js';

const router = express.Router();

/**
 * @swagger
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: Получить профиль текущего пользователя
 *     responses:
 *       200:
 *         description: Профиль получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Требуется авторизация
 */
router.get('/', authMiddleware, getProfile);

/**
 * @swagger
 * /profile:
 *   put:
 *     tags: [Profile]
 *     summary: Обновить профиль текущего пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               profession:
 *                 type: string
 *               fieldOfActivity:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       200:
 *         description: Профиль обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Требуется авторизация
 */
router.put('/', authMiddleware, validate(profileSchemas.updateProfileSchema), updateProfile);

export default router;
