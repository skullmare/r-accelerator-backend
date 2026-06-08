import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import programSchemas from '../../schemas/study/program.schema.js';
import lessonSchemas from '../../schemas/study/lesson.schema.js';
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

// вступить в программу по QR-коду — добавляет программу в массив studyPrograms пользователя
router.post('/join', authMiddleware, validate(programSchemas.joinProgramSchema), joinProgram);

// получить программу со смёрженным прогрессом (accessible и completed на каждом элементе)
router.get('/:programId/progress',
    authMiddleware,
    checkAccessProgram,
    validate(programSchemas.programProgressSchema),
    getProgress
);

// получить урок с ответами пользователя из прогресса (без isCorrect)
router.get('/:programId/lessons/:lessonId',
    authMiddleware,
    checkAccessProgram,
    checkAccessLesson,
    checkItemUnlocked,
    validate(lessonSchemas.getLessonWithProgressSchema),
    getProgressLesson
);

// отметить урок пройденным и сохранить ответы на тест
router.post('/:programId/lessons/:lessonId/complete',
    authMiddleware,
    checkAccessProgram,
    checkAccessLesson,
    checkItemUnlocked,
    validate(lessonSchemas.completeLessonSchema),
    completeLesson
);

// получить агента (доступен только если предыдущий урок пройден)
router.get('/:programId/agents/:agentId',
    authMiddleware,
    checkAccessProgram,
    checkAccessAgent,
    checkItemUnlocked,
    getProgressAgent
);

// история сообщений с агентом с пагинацией
router.get('/:programId/agents/:agentId/messages',
    authMiddleware,
    checkAccessProgram,
    checkAccessAgent,
    checkItemUnlocked,
    validate(messageSchemas.listMessagesSchema),
    listMessages
);

// отправить сообщение агенту (SSE-стриминг)
router.post('/:programId/agents/:agentId/messages',
    authMiddleware,
    checkAccessProgram,
    checkAccessAgent,
    checkItemUnlocked,
    validate(messageSchemas.createMessageSchema),
    createMessage
);

export default router;
