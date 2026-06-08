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

const router = express.Router();

// список всех программ (без популяции items) — для admin-панели
router.get('/', authMiddleware, checkPermission('study_programs.read'), listPrograms);

// создать программу (name, sequential, active) — QR-код генерируется автоматически
router.post('/', authMiddleware, checkPermission('study_programs.create'), validate(programSchemas.createProgramSchema), createProgram);

// получить программу с полной популяцией modules.items (уроки и агенты)
router.get('/:programId', authMiddleware, checkPermission('study_programs.read'), validate(programSchemas.programIdSchema), getProgram);

// обновить мета-данные программы (name, sequential, active, updateQRCode)
router.patch('/:programId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.updateProgramSchema), updateProgram);

// удалить программу
router.delete('/:programId', authMiddleware, checkPermission('study_programs.delete'), validate(programSchemas.programIdSchema), deleteProgram);

// добавить модуль в программу
router.post('/:programId/modules', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.addModuleSchema), addModule);

// переименовать модуль
router.patch('/:programId/modules/:moduleId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.updateModuleSchema), updateModule);

// удалить модуль из программы
router.delete('/:programId/modules/:moduleId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.deleteModuleSchema), deleteModule);

// добавить урок или агента в модуль
router.post('/:programId/modules/:moduleId/items', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.addModuleItemSchema), addModuleItem);

// удалить элемент из модуля
router.delete('/:programId/modules/:moduleId/items/:itemId', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.deleteModuleItemSchema), deleteModuleItem);

// изменить порядок элементов в модуле (передаём новый массив items целиком)
router.patch('/:programId/modules/:moduleId/items/reorder', authMiddleware, checkPermission('study_programs.update'), validate(programSchemas.reorderModuleItemsSchema), reorderModuleItems);

export default router;
