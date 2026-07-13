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
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Список программ получен" }
 *                 data:
 *                   type: array
 *                   description: >
 *                     list-programs.controller.js делает StudyProgram.find с проекцией
 *                     'name description coverMeta cover sequential active qrCode createdAt'
 *                     без populate — поле modules в списке отсутствует.
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Идентификатор программы.
 *                       name:
 *                         type: string
 *                         description: Название программы обучения.
 *                       description:
 *                         type: string
 *                         nullable: true
 *                         description: Описание программы для каталога.
 *                       coverMeta:
 *                         type: object
 *                         nullable: true
 *                         additionalProperties: true
 *                         description: >
 *                           Технические метаданные обложки из S3 (например, размер/тип) —
 *                           произвольная структура, задаётся на загрузке обложки.
 *                       cover:
 *                         type: string
 *                         nullable: true
 *                         description: URL обложки программы для каталога.
 *                       sequential:
 *                         type: boolean
 *                         description: Если true — элементы программы открываются строго по порядку.
 *                       active:
 *                         type: boolean
 *                         description: >
 *                           Активна ли программа. join-program.controller.js ищет программу
 *                           по qrCode только среди active:true.
 *                       qrCode:
 *                         type: string
 *                         description: >
 *                           Уникальный код (по факту — SHA-256-хэш) для присоединения к
 *                           программе через POST /study/programs/join.
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Момент создания программы.
 *       403:
 *         description: Недостаточно прав
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Название программы обучения.
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *                 description: Небольшой текст описания для каталога программ.
 *               coverMeta:
 *                 type: object
 *                 nullable: true
 *                 additionalProperties: true
 *                 description: Произвольный JSON-объект с мета-данными обложки для UI (например, размер/тип из S3).
 *               cover:
 *                 type: string
 *                 nullable: true
 *                 description: URL обложки программы.
 *               sequential:
 *                 type: boolean
 *                 default: true
 *                 description: >
 *                   Если true — элементы программы открываются строго по порядку
 *                   (см. check-item-unlocked.middleware.js). Если false — доступны сразу все.
 *               active:
 *                 type: boolean
 *                 default: true
 *                 description: >
 *                   Активна ли программа. join-program.controller.js позволяет присоединиться
 *                   по qrCode только к программам с active:true.
 *     responses:
 *       201:
 *         description: Программа создана. qrCode генерируется автоматически (SHA-256-хэш), modules всегда пуст при создании.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Программа создана" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Идентификатор программы.
 *                     name:
 *                       type: string
 *                       description: Название программы обучения.
 *                     cover:
 *                       type: string
 *                       nullable: true
 *                       description: URL обложки программы.
 *                     sequential:
 *                       type: boolean
 *                       description: Если true — элементы программы открываются строго по порядку.
 *                     active:
 *                       type: boolean
 *                       description: Активна ли программа.
 *                     qrCode:
 *                       type: string
 *                       description: >
 *                         Уникальный код (SHA-256-хэш) для присоединения к программе через
 *                         POST /study/programs/join.
 *                     modules:
 *                       type: array
 *                       items: {}
 *                       example: []
 *                       description: Модули программы — всегда пустой массив сразу после создания.
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Момент создания программы.
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Момент последнего изменения программы.
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware, checkPermission('study_programs.create'), validate(programSchemas.createProgramSchema), createProgram);

/**
 * @swagger
 * /study/programs/{programId}:
 *   get:
 *     tags: [Study / Programs]
 *     summary: Получить программу по ID
 *     description: >
 *       Требует право 'study_programs.read'. Возвращает программу с модулями.
 *       get-program.controller.js делает .populate('modules.items.item') без выбора
 *       полей, поэтому item внутри каждого элемента модуля — это ПОЛНЫЙ документ
 *       StudyLesson или StudyAgent (в зависимости от соседнего поля type), а не ID-строка.
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
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Программа получена" }
 *                 data:
 *                   $ref: '#/components/schemas/StudyProgram'
 *       404:
 *         description: Программа не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Название программы обучения.
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *                 description: Небольшой текст описания для каталога программ.
 *               coverMeta:
 *                 type: object
 *                 nullable: true
 *                 additionalProperties: true
 *                 description: Произвольный JSON-объект с мета-данными обложки.
 *               cover:
 *                 type: string
 *                 nullable: true
 *                 description: URL обложки программы.
 *               sequential:
 *                 type: boolean
 *                 description: Если true — элементы программы открываются строго по порядку.
 *               active:
 *                 type: boolean
 *                 description: Активна ли программа (только активные доступны для join по qrCode).
 *               updateQRCode:
 *                 type: boolean
 *                 description: >
 *                   Если true — сгенерировать новый qrCode (update-program.controller.js
 *                   заменяет его свежим crypto.randomBytes(32).toString('hex')). Само поле
 *                   updateQRCode в базу не пишется, используется только как флаг для контроллера.
 *     responses:
 *       200:
 *         description: Программа обновлена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Программа обновлена" }
 *                 data:
 *                   type: object
 *                   description: >
 *                     Полный документ программы без populate — items внутри модулей
 *                     содержат item как ID-строку (в отличие от GET /study/programs/{programId}).
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Идентификатор программы.
 *                     name:
 *                       type: string
 *                       description: Название программы обучения.
 *                     cover:
 *                       type: string
 *                       nullable: true
 *                       description: URL обложки программы.
 *                     sequential:
 *                       type: boolean
 *                       description: Если true — элементы программы открываются строго по порядку.
 *                     active:
 *                       type: boolean
 *                       description: Активна ли программа.
 *                     qrCode:
 *                       type: string
 *                       description: Уникальный код (SHA-256-хэш) для присоединения к программе.
 *                     modules:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StudyModule'
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Момент создания программы.
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Момент последнего изменения программы.
 *       404:
 *         description: Программа не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Программа удалена" }
 *                 data: { type: object, example: {} }
 *       404:
 *         description: Программа не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Название модуля программы.
 *     responses:
 *       201:
 *         description: Модуль добавлен. items всегда пуст сразу после добавления.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Модуль добавлен" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Идентификатор модуля.
 *                     name:
 *                       type: string
 *                       description: Название модуля программы.
 *                     items:
 *                       type: array
 *                       items: {}
 *                       example: []
 *                       description: Список элементов модуля — пуст сразу после создания.
 *       404:
 *         description: Программа не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Массив ID модулей в новом порядке — должен содержать все moduleId программы.
 *     responses:
 *       200:
 *         description: Порядок модулей обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Порядок модулей обновлён" }
 *                 data:
 *                   type: array
 *                   description: Модули программы (program.modules) в новом порядке.
 *                   items:
 *                     $ref: '#/components/schemas/StudyModule'
 *       400:
 *         description: Один или несколько moduleId не принадлежат программе
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Программа не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Новое название модуля программы.
 *     responses:
 *       200:
 *         description: Модуль обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Модуль обновлён" }
 *                 data:
 *                   $ref: '#/components/schemas/StudyModule'
 *       404:
 *         description: Программа или модуль не найдены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Модуль удалён" }
 *                 data: { type: object, example: {} }
 *       404:
 *         description: Программа не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: Тип добавляемого элемента — определяет, в какую коллекцию ссылается item.
 *               item:
 *                 type: string
 *                 description: ID урока (если type=StudyLesson) или агента (если type=StudyAgent).
 *     responses:
 *       201:
 *         description: >
 *           Элемент добавлен. add-module-item.controller.js не делает populate, поэтому
 *           item в ответе — это ID-строка, а не документ.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Элемент добавлен в модуль" }
 *                 data:
 *                   $ref: '#/components/schemas/ModuleItem'
 *       404:
 *         description: Программа или модуль не найдены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Элемент удалён из модуля" }
 *                 data: { type: object, example: {} }
 *       404:
 *         description: Программа или модуль не найдены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *                 description: >
 *                   Полный новый массив элементов модуля в нужном порядке — полностью
 *                   заменяет modules.$.items (reorder-module-items.controller.js делает
 *                   $set, а не переупорядочивание по _id).
 *                 items:
 *                   type: object
 *                   required: [type, item]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [StudyLesson, StudyAgent]
 *                       description: Тип элемента — определяет, в какую коллекцию ссылается item.
 *                     item:
 *                       type: string
 *                       description: ID урока или агента.
 *     responses:
 *       200:
 *         description: Порядок элементов обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Порядок элементов обновлён" }
 *                 data:
 *                   type: array
 *                   description: Обновлённый список items модуля (без populate).
 *                   items:
 *                     $ref: '#/components/schemas/ModuleItem'
 *       404:
 *         description: Программа или модуль не найдены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:programId/modules/:moduleId/items/reorder', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.reorderModuleItemsSchema), reorderModuleItems);

export default router;
