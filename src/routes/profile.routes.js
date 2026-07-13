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
 *     description: role заполняется как { _id, name, permissions }, studyPrograms — как список { _id, name }.
 *     responses:
 *       200:
 *         description: Профиль получен.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Профиль получен" }
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, getProfile);

/**
 * @swagger
 * /profile:
 *   put:
 *     tags: [Profile]
 *     summary: Обновить профиль текущего пользователя
 *     description: Обновляет только перечисленные ниже поля. В отличие от GET /profile, ответ НЕ популирует role/studyPrograms — они возвращаются как есть (id или массив id, без объектов).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Имя пользователя.
 *               lastName:
 *                 type: string
 *                 description: Фамилия пользователя.
 *               profession:
 *                 type: string
 *                 description: Профессия.
 *               fieldOfActivity:
 *                 type: string
 *                 description: Сфера деятельности.
 *               city:
 *                 type: string
 *                 description: Город.
 *     responses:
 *       200:
 *         description: Профиль обновлён.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Профиль обновлён" }
 *                 data:
 *                   type: object
 *                   description: Полный документ User, но role/studyPrograms — непопулированные id (см. описание эндпоинта), а не объекты как в GET /profile.
 *                   properties:
 *                     _id: { type: string }
 *                     email: { type: string, format: email }
 *                     role: { type: string, nullable: true, description: "Id роли, без популяции." }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     profession: { type: string }
 *                     fieldOfActivity: { type: string }
 *                     city: { type: string }
 *                     studyPrograms:
 *                       type: array
 *                       items: { type: string }
 *                       description: Id программ, без популяции.
 *                     isSystem: { type: boolean }
 *                     lastLogin: { type: string, format: date-time }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/', authMiddleware, validate(profileSchemas.updateProfileSchema), updateProfile);

export default router;
