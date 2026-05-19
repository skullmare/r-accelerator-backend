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
 *     summary: История сообщений с агентом
 *     description: Возвращает сообщения текущего пользователя с указанным агентом, отсортированные по возрастанию даты.
 *     parameters:
 *       - in: query
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID агента
 *     responses:
 *       200:
 *         description: Список сообщений
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CourseMessage'
 *       400:
 *         description: Ошибка валидации (agentId не передан или некорректен)
 */
router.get('/', authMiddleware, validate(messageSchemas.listMessagesSchema), listMessages);

/**
 * @swagger
 * /course/messages:
 *   post:
 *     tags: [Course / Messages]
 *     summary: Отправить сообщение агенту
 *     description: |
 *       Отправляет сообщение агенту через OpenAI Assistants API и сохраняет оба сообщения (пользователя и агента) в БД.
 *       При первом обращении создаётся OpenAI thread для пользователя.
 *       Пользователь должен состоять в активной группе, в которую входит выбранный агент.
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
 *       201:
 *         description: Сообщение отправлено, ответ агента получен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userMessage:
 *                   $ref: '#/components/schemas/CourseMessage'
 *                 agentMessage:
 *                   $ref: '#/components/schemas/CourseMessage'
 *       403:
 *         description: Нет доступа к агенту или группа неактивна
 *       404:
 *         description: Агент не найден
 */
router.post('/', authMiddleware, validate(messageSchemas.createMessageSchema), createMessage);

export default router;
