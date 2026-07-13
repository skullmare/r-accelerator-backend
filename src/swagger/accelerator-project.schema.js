/**
 * @swagger
 * components:
 *   schemas:
 *     AcceleratorProject:
 *       type: object
 *       description: Проект пользователя в Р-Акселераторе — общий держатель контекста для всего экспертного маршрута (сессии, сообщения, артефакты, файлы).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор проекта.
 *         ownerId:
 *           type: string
 *           description: Владелец проекта — единственный, кому разрешён доступ ко всем данным проекта (сессиям, файлам, артефактам).
 *         name:
 *           type: string
 *           description: Название проекта/стартапа.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Свободное описание проекта от пользователя.
 *         userRole:
 *           type: string
 *           nullable: true
 *           description: Роль пользователя в проекте (например "основатель").
 *         industry:
 *           type: string
 *           nullable: true
 *           description: Отрасль/индустрия проекта.
 *         businessSpecifics:
 *           type: string
 *           nullable: true
 *           description: Специфика бизнеса — свободный текст с деталями, которые не укладываются в отдельные поля.
 *         stage:
 *           type: string
 *           enum: [idea, mvp, launched, growth, scale]
 *           description: Стадия проекта.
 *         goal:
 *           type: string
 *           nullable: true
 *           description: Текущая цель пользователя по проекту.
 *         status:
 *           type: string
 *           enum: [active, paused, completed, archived]
 *           description: Статус проекта. Не влияет на доступ к экспертному маршруту — только для организации списка проектов.
 *         progress:
 *           type: number
 *           description: Общий прогресс проекта в процентах (0-100) — вычисляется отдельно, не связан напрямую с экспертным маршрутом.
 *         currentAgentId:
 *           type: string
 *           nullable: true
 *           description: _id агента, который сейчас активен для этого проекта. null у нового проекта — самолечится при первом обращении к GET expert-route или POST expert-sessions (подставляется первый активный агент по order).
 *         completedAgentIds:
 *           type: array
 *           items: { type: string }
 *           description: Список _id агентов, чьи этапы уже пройдены (артефакт подтверждён). Используется, чтобы показать статус "completed" в GET expert-route.
 *         contextSummary:
 *           type: string
 *           nullable: true
 *           description: Краткая сводка проекта, накапливаемая по мере прохождения этапов — после каждого подтверждения артефакта сюда дописывается его summary. Это единственное поле, которое всегда подмешивается в промпт любого агента (если явно не отключено в contextPolicy агента).
 *         contextVersion:
 *           type: integer
 *           description: Счётчик версий contextSummary — увеличивается на 1 при каждом обновлении сводки.
 *         qdrantCollection:
 *           type: string
 *           nullable: true
 *           description: Переопределение имени коллекции Qdrant для этого проекта. Задел на будущее — сейчас нигде не используется, весь поиск идёт по единой коллекции.
 *         lastActivityAt:
 *           type: string
 *           format: date-time
 *           description: Дата последней активности по проекту — обновляется при подтверждении артефакта экспертного этапа.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания проекта.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения проекта.
 */
