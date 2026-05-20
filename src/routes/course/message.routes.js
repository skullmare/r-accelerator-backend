import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import messageSchemas from '../../schemas/course/message.schema.js';
import { createMessage } from '../../controllers/course/message/create-message.controller.js';
import { listMessages } from '../../controllers/course/message/list-messages.controller.js';

const router = express.Router();

/**
 * @swagger
 * /course/messages:
 *   get:
 *     tags: [Course / Messages]
 *     summary: История сообщений с агентом (с пагинацией)
 *     description: |
 *       Возвращает сообщения текущего пользователя с указанным агентом, отсортированные по возрастанию даты.
 *       Поддерживает постраничную загрузку (по 10 сообщений) для реализации бесконечного скролла на клиенте.
 *       При достижении последней страницы поле `hasMore` вернёт `false`.
 *     parameters:
 *       - in: query
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID агента
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Количество сообщений на странице
 *     responses:
 *       200:
 *         description: Список сообщений с метаданными пагинации
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CourseMessage'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Ошибка валидации (agentId не передан или некорректен)
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
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, validate(messageSchemas.listMessagesSchema), listMessages);

/**
 * @swagger
 * /course/messages:
 *   post:
 *     tags: [Course / Messages]
 *     summary: Отправить сообщение агенту (SSE-стриминг)
 *     description: |
 *       Отправляет сообщение агенту через OpenAI Assistants API и стримит ответ по протоколу Server-Sent Events.
 *       При первом обращении создаётся OpenAI thread для пользователя.
 *       Пользователь должен состоять в активной группе, в которую входит выбранный агент.
 *
 *       **Формат событий SSE:**
 *       - `message_created` — сохранённое сообщение пользователя: `{ userMessage }`
 *       - `delta` — фрагмент ответа агента: `{ text: "..." }`
 *       - `done` — финальное сохранённое сообщение агента: `{ agentMessage }`
 *       - `error` — ошибка в процессе стриминга: `{ message, code }`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, messageText]
 *             properties:
 *               agentId:
 *                 type: string
 *               messageText:
 *                 type: string
 *                 maxLength: 4000
 *     responses:
 *       200:
 *         description: SSE-поток с событиями стриминга
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Ошибка валидации данных
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
 *       403:
 *         description: Нет доступа к агенту или группа неактивна
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Агент не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware, validate(messageSchemas.createMessageSchema), createMessage);

export default router;
