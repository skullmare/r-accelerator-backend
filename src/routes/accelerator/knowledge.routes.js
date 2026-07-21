import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import knowledgeSchemas from '../../schemas/accelerator/knowledge.schema.js';
import { createKnowledge } from '../../controllers/accelerator/knowledge/create-knowledge.controller.js';
import { listKnowledge } from '../../controllers/accelerator/knowledge/list-knowledge.controller.js';
import { getKnowledge } from '../../controllers/accelerator/knowledge/get-knowledge.controller.js';
import { updateKnowledge } from '../../controllers/accelerator/knowledge/update-knowledge.controller.js';
import { deleteKnowledge } from '../../controllers/accelerator/knowledge/delete-knowledge.controller.js';
import { reindexKnowledge } from '../../controllers/accelerator/knowledge/reindex-knowledge.controller.js';

const MANAGE = 'accelerator_knowledge.manage';
const router = express.Router();

router.use(authMiddleware, checkPermission(MANAGE));

/**
 * @swagger
 * /accelerator/admin/knowledge:
 *   get:
 *     tags: [Accelerator / Admin Knowledge]
 *     summary: Список баз знаний
 *     description: Только для пользователей с правом accelerator_knowledge.manage. Возвращает все knowledge, отсортированные по дате создания (новые первыми).
 *     responses:
 *       200: { description: Список баз знаний }
 *       401: { description: Требуется авторизация }
 *       403: { description: Недостаточно прав }
 */
router.get('/', listKnowledge);

/**
 * @swagger
 * /accelerator/admin/knowledge:
 *   post:
 *     tags: [Accelerator / Admin Knowledge]
 *     summary: Создать базу знаний
 *     description: |
 *       Создаёт knowledge и СИНХРОННО векторизует её (очереди нет — ответ
 *       возвращается уже с итоговым status). Источник — ровно один из двух:
 *       fileId (уже загруженный в S3 файл) ИЛИ sourceUrl (внешняя ссылка).
 *       Поддерживаемые форматы: txt/md, pdf, docx. Векторы пишутся в отдельную
 *       Qdrant-коллекцию knowledge_context.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, description: "Название базы знаний." }
 *               description: { type: string, nullable: true, description: "Описание (для UI)." }
 *               fileId: { type: string, description: "_id уже загруженного File. Взаимоисключим с sourceUrl." }
 *               sourceUrl: { type: string, description: "Внешняя ссылка на файл. Взаимоисключима с fileId." }
 *     responses:
 *       201: { description: База знаний создана (с итоговым статусом обработки) }
 *       400: { description: Ошибка валидации / источник не найден / указаны оба источника }
 *       401: { description: Требуется авторизация }
 *       403: { description: Недостаточно прав }
 */
router.post('/', validate(knowledgeSchemas.createKnowledgeSchema), createKnowledge);

/**
 * @swagger
 * /accelerator/admin/knowledge/{knowledgeId}:
 *   get:
 *     tags: [Accelerator / Admin Knowledge]
 *     summary: Получить базу знаний по ID
 *     parameters:
 *       - in: path
 *         name: knowledgeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: База знаний получена }
 *       404: { description: База знаний не найдена }
 */
router.get('/:knowledgeId', validate(knowledgeSchemas.knowledgeIdSchema), getKnowledge);

/**
 * @swagger
 * /accelerator/admin/knowledge/{knowledgeId}:
 *   patch:
 *     tags: [Accelerator / Admin Knowledge]
 *     summary: Обновить метаданные базы знаний
 *     description: Меняет только title/description. Источник и векторы не трогаются — для переиндексации используйте POST .../reindex.
 *     parameters:
 *       - in: path
 *         name: knowledgeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string, nullable: true }
 *     responses:
 *       200: { description: База знаний обновлена }
 *       404: { description: База знаний не найдена }
 */
router.patch('/:knowledgeId', validate(knowledgeSchemas.updateKnowledgeSchema), updateKnowledge);

/**
 * @swagger
 * /accelerator/admin/knowledge/{knowledgeId}:
 *   delete:
 *     tags: [Accelerator / Admin Knowledge]
 *     summary: Удалить базу знаний
 *     description: Удаляет документ, чистит её точки в Qdrant и убирает ссылку из knowledgeIds всех агентов.
 *     parameters:
 *       - in: path
 *         name: knowledgeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: База знаний удалена }
 *       404: { description: База знаний не найдена }
 */
router.delete('/:knowledgeId', validate(knowledgeSchemas.knowledgeIdSchema), deleteKnowledge);

/**
 * @swagger
 * /accelerator/admin/knowledge/{knowledgeId}/reindex:
 *   post:
 *     tags: [Accelerator / Admin Knowledge]
 *     summary: Переиндексировать базу знаний
 *     description: |
 *       Синхронно перевекторизует knowledge (чистит старые точки и пишет
 *       новые). Опционально можно переопределить источник, передав новый
 *       fileId ИЛИ sourceUrl.
 *     parameters:
 *       - in: path
 *         name: knowledgeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileId: { type: string, description: "Новый источник-файл (взаимоисключим с sourceUrl)." }
 *               sourceUrl: { type: string, description: "Новый источник-ссылка (взаимоисключима с fileId)." }
 *     responses:
 *       200: { description: База знаний переиндексирована }
 *       400: { description: Указаны оба источника / файл не найден }
 *       404: { description: База знаний не найдена }
 */
router.post('/:knowledgeId/reindex', validate(knowledgeSchemas.reindexKnowledgeSchema), reindexKnowledge);

export default router;
