import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import checkAccessProject from '../../middlewares/check-access-project.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import projectSchemas from '../../schemas/accelerator/project.schema.js';
import { listProjects } from '../../controllers/accelerator/project/list-projects.controller.js';
import { createProject } from '../../controllers/accelerator/project/create-project.controller.js';
import { getProject } from '../../controllers/accelerator/project/get-project.controller.js';
import { updateProject } from '../../controllers/accelerator/project/update-project.controller.js';
import { listProjectFiles } from '../../controllers/accelerator/file/list-project-files.controller.js';
import { reindexFile } from '../../controllers/accelerator/file/reindex-file.controller.js';
import { getFileProcessingStatus } from '../../controllers/accelerator/file/get-file-processing-status.controller.js';
import expertSessionSchemas from '../../schemas/accelerator/expert-session.schema.js';
import { getExpertRoute } from '../../controllers/accelerator/expert-session/get-expert-route.controller.js';
import { createExpertSession } from '../../controllers/accelerator/expert-session/create-session.controller.js';
import { sendExpertMessage } from '../../controllers/accelerator/expert-session/send-message.controller.js';
import { getSessionMessages } from '../../controllers/accelerator/expert-session/get-session-messages.controller.js';
import { completeExpertSession } from '../../controllers/accelerator/expert-session/complete-session.controller.js';
import { listProjectArtifacts } from '../../controllers/accelerator/artifact/list-project-artifacts.controller.js';

const router = express.Router();

/**
 * @swagger
 * /accelerator/projects:
 *   get:
 *     tags: [Accelerator / Projects]
 *     summary: Список проектов текущего пользователя
 *     description: Возвращает только проекты, принадлежащие авторизованному пользователю, отсортированные по lastActivityAt.
 *     responses:
 *       200:
 *         description: Список проектов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Список проектов получен" }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AcceleratorProject'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, listProjects);

/**
 * @swagger
 * /accelerator/projects:
 *   post:
 *     tags: [Accelerator / Projects]
 *     summary: Создать проект
 *     description: Владельцем создаваемого проекта становится текущий авторизованный пользователь. currentAgentId, contextSummary и остальные поля экспертного маршрута выставляются позже автоматически, при первом обращении к маршруту.
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
 *                 maxLength: 150
 *                 description: Название проекта/стартапа.
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *                 description: Свободное описание проекта.
 *               userRole:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *                 description: Роль пользователя в проекте.
 *               industry:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *                 description: Отрасль/индустрия проекта.
 *               businessSpecifics:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *                 description: Специфика бизнеса, свободный текст.
 *               stage:
 *                 type: string
 *                 enum: [idea, mvp, launched, growth, scale]
 *                 description: Стадия проекта.
 *               goal:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 1000
 *                 description: Текущая цель пользователя по проекту.
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, archived]
 *                 description: Статус проекта.
 *     responses:
 *       201:
 *         description: Проект создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Проект создан" }
 *                 data:
 *                   $ref: '#/components/schemas/AcceleratorProject'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware, validate(projectSchemas.createProjectSchema), createProject);

/**
 * @swagger
 * /accelerator/projects/{projectId}:
 *   get:
 *     tags: [Accelerator / Projects]
 *     summary: Получить проект по ID
 *     description: Доступ только у владельца проекта.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Проект получен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Проект получен" }
 *                 data:
 *                   $ref: '#/components/schemas/AcceleratorProject'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Нет доступа к проекту
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Проект не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:projectId', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, getProject);

/**
 * @swagger
 * /accelerator/projects/{projectId}:
 *   patch:
 *     tags: [Accelerator / Projects]
 *     summary: Обновить проект
 *     description: Доступ только у владельца проекта. lastActivityAt обновляется автоматически. Поля экспертного маршрута (currentAgentId, contextSummary и т.д.) через этот эндпоинт не редактируются — только сервером.
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *                 maxLength: 150
 *               description:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               userRole:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *               industry:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 150
 *               businessSpecifics:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 2000
 *               stage:
 *                 type: string
 *                 enum: [idea, mvp, launched, growth, scale]
 *               goal:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, archived]
 *     responses:
 *       200:
 *         description: Проект обновлён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Проект обновлён" }
 *                 data:
 *                   $ref: '#/components/schemas/AcceleratorProject'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Требуется авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Нет доступа к проекту
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Проект не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:projectId', authMiddleware, validate(projectSchemas.updateProjectSchema), checkAccessProject, updateProject);

/**
 * @swagger
 * /accelerator/projects/{projectId}/files:
 *   get:
 *     tags: [Accelerator / Files]
 *     summary: Список файлов проекта со статусами обработки
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Список файлов проекта
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Файлы проекта получены" }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:projectId/files', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, listProjectFiles);

/**
 * @swagger
 * /accelerator/projects/{projectId}/files/{fileId}/index:
 *   post:
 *     tags: [Accelerator / Files]
 *     summary: (Пере)индексировать файл в Qdrant
 *     description: Синхронно извлекает текст, чанкует и индексирует файл в Qdrant (очереди нет — запрос дожидается завершения). Идемпотентно — старые точки файла удаляются перед записью новых.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Файл переиндексирован (с итоговым статусом)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Файл переиндексирован" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     processingStatus:
 *                       type: string
 *                       example: indexed
 *                       description: Итоговый статус файла после обработки (см. File.processingStatus).
 *                     qdrantStatus: { type: string, example: indexed }
 *                     processingErrorCode: { type: string, nullable: true, example: null }
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект или файл не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:projectId/files/:fileId/index', authMiddleware, validate(projectSchemas.projectFileIdSchema), checkAccessProject, reindexFile);

/**
 * @swagger
 * /accelerator/projects/{projectId}/files/{fileId}/processing-status:
 *   get:
 *     tags: [Accelerator / Files]
 *     summary: Статус обработки и индексирования файла
 *     description: Возвращает только статусные поля (не полную запись File — см. GET .../files для полного списка).
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Статус обработки файла
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Статус обработки файла получен" }
 *                 data:
 *                   $ref: '#/components/schemas/FileProcessingStatus'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект или файл не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:projectId/files/:fileId/processing-status', authMiddleware, validate(projectSchemas.projectFileIdSchema), checkAccessProject, getFileProcessingStatus);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-route:
 *   get:
 *     tags: [Accelerator / Expert Route]
 *     summary: Текущий агент и маршрут проекта
 *     description: |
 *       Все агенты по порядку (order) со статусом относительно этого проекта:
 *       completed / current / locked. Промпты агентов в ответ не попадают —
 *       только отображаемые поля.
 *
 *       У нового проекта currentAgentId ещё не выставлен: он проставляется
 *       здесь — первым агентом по order. Если маршрут пройден целиком,
 *       currentAgentId = null и все items имеют статус completed.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Маршрут получен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Маршрут агентов получен" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentAgentId:
 *                       type: string
 *                       nullable: true
 *                       description: _id текущего активного агента проекта (см. Project.currentAgentId).
 *                     items:
 *                       type: array
 *                       description: Все активные агенты системы, по порядку, со статусом относительно этого проекта.
 *                       items:
 *                         $ref: '#/components/schemas/ExpertRouteItem'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:projectId/expert-route', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, getExpertRoute);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions:
 *   post:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Начать (или продолжить) сессию с текущим агентом проекта
 *     description: |
 *       Тело запроса можно не передавать: сессия всегда открывается с текущим
 *       агентом маршрута. Если активная сессия с ним уже есть — возвращается
 *       она же, новая не создаётся, поэтому эндпоинт безопасно вызывать при
 *       каждом входе в проект.
 *
 *       Если agentId всё же передан, он должен совпадать с текущим агентом —
 *       иначе 409 AGENT_NOT_CURRENT (перепрыгнуть этап нельзя).
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: Необязательная проверка — _id агента, с которым фронт рассчитывает продолжить диалог.
 *     responses:
 *       201:
 *         description: Сессия создана или найдена активная
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Экспертная сессия создана" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     session:
 *                       $ref: '#/components/schemas/ExpertSession'
 *                     agent:
 *                       $ref: '#/components/schemas/ExpertRouteAgent'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: "AGENT_NOT_CURRENT (переданный агент не текущий) или NO_CURRENT_AGENT (маршрут пройден либо агенты не заведены)", content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:projectId/expert-sessions', authMiddleware, validate(expertSessionSchemas.createSessionSchema), checkAccessProject, createExpertSession);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions/{sessionId}/messages:
 *   post:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Отправить сообщение агенту (SSE-стриминг)
 *     description: |
 *       Сервер собирает контекст (summary проекта, системный промпт агента,
 *       релевантные фрагменты из Qdrant, отфильтрованные по projectId) и
 *       стримит ответ модели по протоколу Server-Sent Events. Клиент
 *       никогда не обращается к LLM/Qdrant напрямую.
 *
 *       Ошибки, которые можно определить до начала стриминга (сессия/агент
 *       не найдены, сессия уже завершена), возвращаются обычным JSON-ответом
 *       с кодом ошибки — заголовки переключаются на text/event-stream только
 *       после этих проверок.
 *
 *       **Формат событий SSE:**
 *       - `message_created` — сохранённое сообщение пользователя: `{ userMessage }`
 *       - `delta` — фрагмент ответа агента по мере генерации: `{ text: "..." }`
 *       - `data_updated` — агент сохранил данные посреди хода: `{ collectedData, readyForArtifact }`. Приходит до `done`, пока агент ещё дописывает реплику; если в этом ходу ничего не сохранялось, события не будет.
 *       - `done` — финальное сообщение агента и состояние этапа: `{ assistantMessage, collectedData, readyForArtifact }`
 *       - `error` — ошибка в процессе стриминга: `{ message, code }`. `code` нормализован до `LLM_PROVIDER_FAILED`, если у исходной ошибки не было своего кода.
 *
 *       **readyForArtifact — когда показывать кнопку завершения этапа.**
 *       Агент по ходу диалога складывает собранные данные в свободное
 *       хранилище сессии (`collectedData`) инструментом `save_data`, а когда
 *       выполняется условие из `completionPrompt` — вызывает `stage_ready`,
 *       и `readyForArtifact` становится `true`. Именно по этому флагу фронт
 *       показывает кнопку «Сформировать документ».
 *
 *       Сервер завершение этапа не блокирует: если пользователь нажмёт кнопку
 *       раньше, документ всё равно будет создан по тем данным, что есть.
 *       Флаг подсказывает момент, а не запирает пользователя на этапе.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 description: Текст сообщения пользователя агенту.
 *     responses:
 *       200:
 *         description: SSE-поток с событиями стриминга (см. описание выше).
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект или сессия не найдена, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Сессия уже завершена, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:projectId/expert-sessions/:sessionId/messages', authMiddleware, validate(expertSessionSchemas.sendMessageSchema), checkAccessProject, sendExpertMessage);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions/{sessionId}/messages:
 *   get:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: История сообщений и состояние сессии
 *     description: |
 *       Все сообщения сессии в хронологическом порядке плюс состояние этапа:
 *       `collectedData` (что агент уже собрал), `readyForArtifact` (показывать
 *       ли кнопку завершения), `artifactId` и `status`. Одним запросом
 *       восстанавливает экран после перезагрузки страницы.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: История сообщений получена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "История сообщений получена" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ExpertMessage'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект или сессия не найдена, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:projectId/expert-sessions/:sessionId/messages', authMiddleware, validate(expertSessionSchemas.sessionIdSchema), checkAccessProject, getSessionMessages);

/**
 * @swagger
 * /accelerator/projects/{projectId}/expert-sessions/{sessionId}/complete:
 *   post:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Завершить этап и получить документ
 *     description: |
 *       Один вызов делает всё: модель пишет документ этапа, сервер верстает
 *       его в PDF и кладёт в S3, сессия закрывается, проект переключается на
 *       следующего агента. Параметров у запроса нет.
 *
 *       Следующий агент — это следующий по `order` (либо `nextAgentId`, если
 *       он задан у текущего агента). Когда следующего нет, маршрут пройден:
 *       `nextAgentId` в ответе = null, а `Project.status` становится
 *       `completed`.
 *
 *       Готовность этапа сервер не проверяет: фронт показывает кнопку по
 *       `readyForArtifact`, но если пользователь завершит этап раньше,
 *       документ будет создан по уже собранным данным. Повторный вызов на
 *       завершённой сессии идемпотентен — возвращает тот же документ.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Этап завершён, документ создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Этап завершён" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     artifact:
 *                       $ref: '#/components/schemas/ExpertArtifact'
 *                     nextAgentId:
 *                       type: string
 *                       nullable: true
 *                       description: Новый Project.currentAgentId. null — маршрут проекта пройден полностью.
 *                     projectContextVersion:
 *                       type: integer
 *                       description: Актуальное значение Project.contextVersion после этого вызова.
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект или сессия не найдена, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       502: { description: "Сбой внешней зависимости: LLM_PROVIDER_FAILED (генерация документа), ARTIFACT_RENDER_FAILED (вёрстка PDF), ARTIFACT_UPLOAD_FAILED (загрузка в S3)", content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/:projectId/expert-sessions/:sessionId/complete', authMiddleware, validate(expertSessionSchemas.sessionIdSchema), checkAccessProject, completeExpertSession);

/**
 * @swagger
 * /accelerator/projects/{projectId}/artifacts:
 *   get:
 *     tags: [Accelerator / Expert Sessions]
 *     summary: Список документов проекта
 *     description: Все документы, созданные по завершённым этапам, в порядке создания — по одному на этап. Используется для панели результатов проекта.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Артефакты проекта получены
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Артефакты проекта получены" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ExpertArtifact'
 *       401: { description: Требуется авторизация, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Нет доступа к проекту, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Проект не найден, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/:projectId/artifacts', authMiddleware, validate(projectSchemas.projectIdSchema), checkAccessProject, listProjectArtifacts);

export default router;
