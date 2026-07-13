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
 *     description: Отправляет 6-значный код на указанный email (действителен 15 минут). Создаёт пользователя, если он не существует.
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
 *                 description: Email, на который будет отправлен код.
 *     responses:
 *       200:
 *         description: Код отправлен.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Код подтверждения отправлен на почту" }
 *                 data: { type: object, example: {} }
 *       429:
 *         description: Код уже был отправлен — нужно подождать (тот же статус используется и при сбое отправки письма на стороне SMTP).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validate(authSchemas.emailSchema), sendCodeToEmail);

/**
 * @swagger
 * /auth/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Подтвердить код и получить токены
 *     description: Проверяет код, выставляет httpOnly cookie accessToken (15 минут) и refreshToken (7 дней, scope /api/v1/auth). После 3 неверных попыток текущий код блокируется — нужно запросить новый через /auth/login.
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
 *                 description: 6-значный код, полученный на email.
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Авторизация прошла успешно, accessToken/refreshToken установлены в cookies.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Авторизация прошла успешно" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, description: "Id пользователя." }
 *                     email: { type: string, format: email }
 *       400:
 *         description: Код не найден, истёк или неверен.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Превышено количество попыток ввода кода (3) — нужно запросить новый код.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/verify', validate(authSchemas.verifyCodeSchema), verificationCode);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Обновить access token
 *     description: Использует refreshToken из cookie, чтобы выдать новую пару accessToken/refreshToken (те же сроки жизни, что и в /auth/verify).
 *     security: []
 *     responses:
 *       200:
 *         description: Токены обновлены, новые accessToken/refreshToken установлены в cookies.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Токены обновлены" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, description: "Id пользователя из refresh-токена." }
 *                     email: { type: string, format: email }
 *       401:
 *         description: refreshToken отсутствует или недействителен.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Выйти из аккаунта
 *     description: Очищает cookies accessToken и refreshToken.
 *     responses:
 *       200:
 *         description: Выход выполнен.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Выход выполнен успешно" }
 *                 data: { type: object, example: {} }
 */
router.post('/logout', logout);

export default router;
