import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import programSchemas from '../../schemas/study/program.schema.js';
import lessonSchemas from '../../schemas/study/lesson.schema.js';
import agentSchemas from '../../schemas/study/agent.schema.js';
import messageSchemas from '../../schemas/study/message.schema.js';
import checkAccessProgram from '../../middlewares/check-access-program.middleware.js';
import checkAccessLesson from '../../middlewares/check-access-lesson.middleware.js';
import checkAccessAgent from '../../middlewares/check-access-agent.middleware.js';
import checkItemUnlocked from '../../middlewares/check-item-unlocked.middleware.js';
import { joinProgram } from '../../controllers/study/program/join-program.controller.js';
import { getProgress } from '../../controllers/study/progress/get-progress.controller.js';
import { getProgressLesson } from '../../controllers/study/progress/get-lesson.controller.js';
import { completeLesson } from '../../controllers/study/progress/complete-lesson.controller.js';
import { getProgressAgent } from '../../controllers/study/progress/get-agent.controller.js';
import { createMessage } from '../../controllers/study/message/create-message.controller.js';
import { listMessages } from '../../controllers/study/message/list-messages.controller.js';

const router = express.Router();

/**
 * @swagger
 * /study/programs/join:
 *   post:
 *     tags: [Study / Progress]
 *     summary: Вступить в программу по QR-коду
 *     description: Добавляет программу в массив 'studyPrograms'текущего пользователя. Если пользователь уже в программе — дубликат не создаётся.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Пользователь добавлен в программу
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 programId:
 *                   type: string
 *       404:
 *         description: Программа не найдена или неактивна
 */
router.post('/join', authMiddleware, validate(programSchemas.joinProgramSchema), joinProgram);

/**
 * @swagger
 * /study/programs/{programId}/progress:
 *   get:
 *     tags: [Study / Progress]
 *     summary: Получить программу со смёрженным прогрессом
 *     description: |
 *       Возвращает структуру программы с флагами 'completed'и 'accessible'на каждом элементе.
 *       - 'completed'— элемент пройден пользователем
 *       - 'accessible'— элемент доступен (при 'sequential=true'зависит от прохождения предыдущего урока)
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Прогресс получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyProgress'
 *       403:
 *         description: Нет доступа к программе или программа неактивна
 *       404:
 *         description: Программа не найдена
 */
router.get('/:programId/progress',
    authMiddleware,
    checkAccessProgram,
    validate(programSchemas.programProgressSchema),
    getProgress
);

/**
 * @swagger
 * /study/programs/{programId}/lessons/{lessonId}:
 *   get:
 *     tags: [Study / Progress]
 *     summary: Получить урок с ответами пользователя
 *     description: |
 *       Возвращает полный урок. К каждому вопросу подмешивается 'userAnswer'— ID ответа, который пользователь выбрал ранее (или 'null).
 *       'isCorrect'у вариантов ответа не возвращается.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Урок получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyLesson'
 *       403:
 *         description: Нет доступа к уроку или предыдущий урок не пройден
 *       404:
 *         description: Урок не найден
 */
router.get('/:programId/lessons/:lessonId',
    authMiddleware,
    checkAccessProgram,
    checkAccessLesson,
    checkItemUnlocked,
    validate(lessonSchemas.getLessonWithProgressSchema),
    getProgressLesson
);

/**
 * @swagger
 * /study/programs/{programId}/lessons/{lessonId}/complete:
 *   post:
 *     tags: [Study / Progress]
 *     summary: Отметить урок пройденным
 *     description: Добавляет урок в 'completedItems'и сохраняет ответы на тест в 'lessonDetails'. При повторном вызове обновляет ответы.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quizAnswers:
 *                 type: array
 *                 description: Ответы пользователя на вопросы теста
 *                 items:
 *                   type: object
 *                   required: [questionId, answerId]
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answerId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Урок отмечен как пройденный
 *       403:
 *         description: Нет доступа к уроку или предыдущий урок не пройден
 */
router.post('/:programId/lessons/:lessonId/complete',
    authMiddleware,
    checkAccessProgram,
    checkAccessLesson,
    checkItemUnlocked,
    validate(lessonSchemas.completeLessonSchema),
    completeLesson
);

/**
 * @swagger
 * /study/programs/{programId}/agents/{agentId}:
 *   get:
 *     tags: [Study / Progress]
 *     summary: Получить агента
 *     description: Возвращает данные агента. Доступен только если предыдущий урок в программе пройден (или 'sequential=false).
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Агент получен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyAgent'
 *       403:
 *         description: Нет доступа к агенту или предыдущий урок не пройден
 *       404:
 *         description: Агент не найден
 */
router.get('/:programId/agents/:agentId',
    authMiddleware,
    checkAccessProgram,
    checkAccessAgent,
    checkItemUnlocked,
    validate(agentSchemas.getProgressAgentSchema),
    getProgressAgent
);

/**
 * @swagger
 * /study/programs/{programId}/agents/{agentId}/messages:
 *   get:
 *     tags: [Study / Progress]
 *     summary: История сообщений с агентом
 *     description: Возвращает сообщения текущего пользователя с агентом, отсортированные по возрастанию даты. Поддерживает пагинацию.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
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
 *                     $ref: '#/components/schemas/StudyMessage'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Нет доступа к агенту
 */
router.get('/:programId/agents/:agentId/messages',
    authMiddleware,
    checkAccessProgram,
    checkAccessAgent,
    checkItemUnlocked,
    validate(messageSchemas.listMessagesSchema),
    listMessages
);

/**
 * @swagger
 * /study/programs/{programId}/agents/{agentId}/messages:
 *   post:
 *     tags: [Study / Progress]
 *     summary: Отправить сообщение агенту (SSE-стриминг)
 *     description: |
 *       Отправляет сообщение агенту через OpenAI Assistants API и стримит ответ по протоколу Server-Sent Events.
 *       При первом обращении создаётся OpenAI thread для пользователя.
 *
 *       **Формат событий SSE:**
 *       - 'message_created'— сохранённое сообщение пользователя: '{ userMessage }
 *       - 'delta'— фрагмент ответа агента: '{ text: "..." }
 *       - 'done'— финальное сохранённое сообщение агента: '{ agentMessage }
 *       - 'error'— ошибка в процессе стриминга: '{ message, code }
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messageText]
 *             properties:
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
 *       403:
 *         description: Нет доступа к агенту или предыдущий урок не пройден
 *       404:
 *         description: Агент не найден
 */
router.post('/:programId/agents/:agentId/messages',
    authMiddleware,
    checkAccessProgram,
    checkAccessAgent,
    checkItemUnlocked,
    validate(messageSchemas.createMessageSchema),
    createMessage
);

export default router;
