import express from "express";
import { sendCodeToEmail } from "../controllers/auth/send-code.controller.js";
import { verificationCode } from "../controllers/auth/verify-code.controller.js";
import { refreshToken } from "../controllers/auth/refresh-token.controller.js";
import { logout } from "../controllers/auth/logout.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import authSchemas from "../schemas/auth.schema.js";

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Отправить код подтверждения на email
 *     description: Отправляет 6-значный код на указанный email. Создаёт пользователя, если он не существует.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Код отправлен
 *       429:
 *         description: Код уже был отправлен, подождите перед повторной отправкой
 */
router.post('/login', validate(authSchemas.emailSchema), sendCodeToEmail);

/**
 * @swagger
 * /auth/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Подтвердить код и получить токены
 *     description: Верифицирует код, устанавливает accessToken и refreshToken в cookies.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Авторизация прошла успешно
 *       400:
 *         description: Неверный или истёкший код
 *       429:
 *         description: Превышено количество попыток
 */
router.post('/verify', validate(authSchemas.verifyCodeSchema), verificationCode);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Обновить access token
 *     description: Использует refreshToken из cookie для выдачи новой пары токенов.
 *     security: []
 *     responses:
 *       200:
 *         description: Токены обновлены
 *       401:
 *         description: Недействительный refresh token
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Выйти из аккаунта
 *     description: Очищает cookies с токенами.
 *     responses:
 *       200:
 *         description: Выход выполнен
 */
router.post('/logout', logout);

export default router;
