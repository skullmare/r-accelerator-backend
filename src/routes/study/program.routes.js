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
import { addModule } from '../../controllers/study/program/add-module.controller.js';
import { updateModule } from '../../controllers/study/program/update-module.controller.js';
import { deleteModule } from '../../controllers/study/program/delete-module.controller.js';
import { addModuleItem } from '../../controllers/study/program/add-module-item.controller.js';
import { deleteModuleItem } from '../../controllers/study/program/delete-module-item.controller.js';
import { reorderModuleItems } from '../../controllers/study/program/reorder-module-items.controller.js';
import { reorderModules } from '../../controllers/study/program/reorder-modules.controller.js';

const router = express.Router();

/**
 * @swagger
 * /study/programs:
 *   get:
 *     tags: [Study / Programs]
 *     summary: Список всех программ обучения
 *     description: Требует право 'study_programs.read'. Возвращает мета-данные без популяции items.
 *     responses:
 *       200:
 *         description: Список программ без модулей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   title:
 *                     type: string
 *                     nullable: true
 *                   subtitle:
 *                     type: string
 *                     nullable: true
 *                   description:
 *                     type: string
 *                     nullable: true
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                   cover:
 *                     type: string
 *                     nullable: true
 *                     description: URL обложки программы
 *                   sequential:
 *                     type: boolean
 *                   active:
 *                     type: boolean
 *                   qrCode:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       403:
 *         description: Недостаточно прав
 */
router.get('/', authMiddleware, checkPermission('study_programs.read'), listPrograms);

/**
 * @swagger
 * /study/programs:
 *   post:
 *     tags: [Study / Programs]
 *     summary: Создать программу обучения
 *     description: Требует право 'study_programs.create'. QR-код генерируется автоматически.
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
 *                 maxLength: 100
 *               title:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 200
 *                 description: Заголовок для UI
 *               subtitle:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 300
 *                 description: Подзаголовок для UI
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *                 description: Небольшой текст для UI
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Массив тегов для UI
 *               cover:
 *                 type: string
 *                 nullable: true
 *                 description: URL обложки программы
 *               sequential:
 *                 type: boolean
 *                 default: true
 *                 description: Если true — уроки открываются последовательно
 *               active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Программа создана
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 cover:
 *                   type: string
 *                   nullable: true
 *                 sequential:
 *                   type: boolean
 *                 active:
 *                   type: boolean
 *                 qrCode:
 *                   type: string
 *                 modules:
 *                   type: array
 *                   items: {}
 *                   example: []
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Ошибка валидации
 */
router.post('/', authMiddleware, checkPermission('study_programs.create'), validate(programSchemas.createProgramSchema), createProgram);

/**
 * @swagger
 * /study/programs/{programId}:
 *   get:
 *     tags: [Study / Programs]
 *     summary: Получить программу по ID
 *     description: Требует право 'study_programs.read'. Возвращает программу с модулями. items внутри модулей содержат item как ID строку (не популяция).
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Программа получена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 cover:
 *                   type: string
 *                   nullable: true
 *                 sequential:
 *                   type: boolean
 *                 active:
 *                   type: boolean
 *                 qrCode:
 *                   type: string
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             type:
 *                               type: string
 *                               enum: [StudyLesson, StudyAgent]
 *                             item:
 *                               type: string
 *                               description: ID урока или агента
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Программа не найдена
 */
router.get('/:programId', authMiddleware, checkPermission('study_programs.read'), validate(programSchemas.programIdSchema), getProgram);

/**
 * @swagger
 * /study/programs/{programId}:
 *   patch:
 *     tags: [Study / Programs]
 *     summary: Обновить мета-данные программы
 *     description: Требует право 'study_programs.update'. Передайте 'updateQRCode=true'для перегенерации QR-кода.
 *     parameters:
 *       - in: path
 *         name: programId
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
 *               title:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 200
 *               subtitle:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 300
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               cover:
 *                 type: string
 *                 nullable: true
 *                 description: URL обложки программы
 *               sequential:
 *                 type: boolean
 *               active:
 *                 type: boolean
 *               updateQRCode:
 *                 type: boolean
 *                 description: Перегенерировать QR-код
 *     responses:
 *       200:
 *         description: Программа обновлена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 cover:
 *                   type: string
 *                   nullable: true
 *                 sequential:
 *                   type: boolean
 *                 active:
 *                   type: boolean
 *                 qrCode:
 *                   type: string
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             type:
 *                               type: string
 *                               enum: [StudyLesson, StudyAgent]
 *                             item:
 *                               type: string
 *                               description: ID урока или агента
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Программа не найдена
 */
router.patch('/:programId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.updateProgramSchema), updateProgram);

/**
 * @swagger
 * /study/programs/{programId}:
 *   delete:
 *     tags: [Study / Programs]
 *     summary: Удалить программу
 *     description: Требует право 'study_programs.delete'.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Программа удалена
 *       404:
 *         description: Программа не найдена
 */
router.delete('/:programId', authMiddleware, checkPermission('study_programs.delete'), validate(programSchemas.programIdSchema), deleteProgram);

/**
 * @swagger
 * /study/programs/{programId}/modules:
 *   post:
 *     tags: [Study / Programs]
 *     summary: Добавить модуль в программу
 *     description: Требует право 'study_programs.update'. Модуль добавляется в конец списка.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
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
 *                 maxLength: 100
 *     responses:
 *       201:
 *         description: Модуль добавлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 items:
 *                   type: array
 *                   items: {}
 *                   example: []
 *       404:
 *         description: Программа не найдена
 */
router.post('/:programId/modules', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.addModuleSchema), addModule);

/**
 * @swagger
 * /study/programs/{programId}/modules/reorder:
 *   patch:
 *     tags: [Study / Programs]
 *     summary: Изменить порядок модулей в программе
 *     description: Требует право 'study_programs.update'. Передаётся полный список moduleId в нужном порядке. Все ID должны принадлежать данной программе.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moduleIds]
 *             properties:
 *               moduleIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 description: Массив ID модулей в новом порядке
 *     responses:
 *       200:
 *         description: Порядок модулей обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         type:
 *                           type: string
 *                           enum: [StudyLesson, StudyAgent]
 *                         item:
 *                           type: string
 *                           description: ID урока или агента
 *       400:
 *         description: Один или несколько moduleId не принадлежат программе
 *       404:
 *         description: Программа не найдена
 */
router.patch('/:programId/modules/reorder', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.reorderModulesSchema), reorderModules);

/**
 * @swagger
 * /study/programs/{programId}/modules/{moduleId}:
 *   patch:
 *     tags: [Study / Programs]
 *     summary: Переименовать модуль
 *     description: Требует право 'study_programs.update'.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
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
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Модуль обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [StudyLesson, StudyAgent]
 *                       item:
 *                         type: string
 *                         description: ID урока или агента
 *       404:
 *         description: Программа или модуль не найдены
 */
router.patch('/:programId/modules/:moduleId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.updateModuleSchema), updateModule);

/**
 * @swagger
 * /study/programs/{programId}/modules/{moduleId}:
 *   delete:
 *     tags: [Study / Programs]
 *     summary: Удалить модуль из программы
 *     description: Требует право 'study_programs.update'. Удаляет модуль вместе со всеми его items.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Модуль удалён
 *       404:
 *         description: Программа не найдена
 */
router.delete('/:programId/modules/:moduleId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.deleteModuleSchema), deleteModule);

/**
 * @swagger
 * /study/programs/{programId}/modules/{moduleId}/items:
 *   post:
 *     tags: [Study / Programs]
 *     summary: Добавить элемент в модуль
 *     description: Требует право 'study_programs.update'. Элемент добавляется в конец списка items модуля.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, item]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [StudyLesson, StudyAgent]
 *               item:
 *                 type: string
 *                 description: ID урока или агента
 *     responses:
 *       201:
 *         description: Элемент добавлен. item возвращается как ID (не популяция)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 type:
 *                   type: string
 *                   enum: [StudyLesson, StudyAgent]
 *                   description: StudyLesson — урок, StudyAgent — агент
 *                 item:
 *                   type: string
 *                   description: ID урока или агента
 *       404:
 *         description: Программа или модуль не найдены
 */
router.post('/:programId/modules/:moduleId/items', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.addModuleItemSchema), addModuleItem);

/**
 * @swagger
 * /study/programs/{programId}/modules/{moduleId}/items/{itemId}:
 *   delete:
 *     tags: [Study / Programs]
 *     summary: Удалить элемент из модуля
 *     description: Требует право 'study_programs.update'.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Элемент удалён
 *       404:
 *         description: Программа или модуль не найдены
 */
router.delete('/:programId/modules/:moduleId/items/:itemId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.deleteModuleItemSchema), deleteModuleItem);

/**
 * @swagger
 * /study/programs/{programId}/modules/{moduleId}/items/reorder:
 *   patch:
 *     tags: [Study / Programs]
 *     summary: Изменить порядок элементов в модуле
 *     description: Требует право 'study_programs.update'. Передаётся полный новый массив items в нужном порядке.
 *     parameters:
 *       - in: path
 *         name: programId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [type, item]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [StudyLesson, StudyAgent]
 *                     item:
 *                       type: string
 *     responses:
 *       200:
 *         description: Порядок элементов обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [StudyLesson, StudyAgent]
 *                   item:
 *                     type: string
 *                     description: ID урока или агента
 *       404:
 *         description: Программа или модуль не найдены
 */
router.patch('/:programId/modules/:moduleId/items/reorder', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.reorderModuleItemsSchema), reorderModuleItems);

export default router;
