import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import programSchemas from '../../schemas/study/program.schema.js';
import { createProgram } from '../../controllers/study/program/create-program.controller.js';
import { getProgram } from '../../controllers/study/program/get-program.controller.js';
import { listPrograms } from '../../controllers/study/program/list-programs.controller.js';
import { updateProgram } from '../../controllers/study/program/update-program.controller.js';
import { deleteProgram } from '../../controllers/study/program/delete-program.controller.js';
import { addToProgram } from '../../controllers/study/program/add-to-program.controller.js';

const router = express.Router();

/**
 * @swagger
 * /study/programs/join:
 *   post:
 *     tags: [Study / Programs]
 *     summary: Вступить в программу по QR-коду
 *     description: Привязывает текущего пользователя к программе по её секретному QR-коду.
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
 *         description: Вы добавлены в программу
 *       404:
 *         description: Программа не найдена
 */
router.post('/join', authMiddleware, validate(programSchemas.addToProgramSchema), addToProgram);

/**
 * @swagger
 * /study/programs:
 *   get:
 *     tags: [Study / Programs]
 *     summary: Список всех программ
 *     description: Требует право `study_programs.read`.
 *     responses:
 *       200:
 *         description: Список программ с популяцией агентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StudyProgram'
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('study_programs.read'), listPrograms);

/**
 * @swagger
 * /study/programs:
 *   post:
 *     tags: [Study / Programs]
 *     summary: Создать программу
 *     description: Требует право `study_programs.create`. QR-код генерируется автоматически.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               agents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Массив ID агентов
 *               active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Программа создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyProgram'
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('study_programs.create'), validate(programSchemas.createProgramSchema), createProgram);

/**
 * @swagger
 * /study/programs/{id}:
 *   get:
 *     tags: [Study / Programs]
 *     summary: Получить программу по ID
 *     description: Требует право `study_programs.read`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Программа получена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyProgram'
 *       404:
 *         description: Программа не найдена
 */
router.get('/:id', authMiddleware, checkPermission('study_programs.read'), validate(programSchemas.programIdSchema), getProgram);

/**
 * @swagger
 * /study/programs/{id}:
 *   put:
 *     tags: [Study / Programs]
 *     summary: Обновить программу
 *     description: Требует право `study_programs.update`. Передайте updateQRCode=true для генерации нового QR-кода.
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *               agents:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *               updateQRCode:
 *                 type: boolean
 *                 description: Пересоздать QR-код
 *     responses:
 *       200:
 *         description: Программа обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudyProgram'
 *       404:
 *         description: Программа не найдена
 */
router.put('/:id', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.updateProgramSchema), updateProgram);

/**
 * @swagger
 * /study/programs/{id}:
 *   delete:
 *     tags: [Study / Programs]
 *     summary: Удалить программу
 *     description: Требует право `study_programs.delete`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Программа удалена
 *       404:
 *         description: Программа не найдена
 */
router.delete('/:id', authMiddleware, checkPermission('study_programs.delete'), validate(programSchemas.programIdSchema), deleteProgram);

export default router;
