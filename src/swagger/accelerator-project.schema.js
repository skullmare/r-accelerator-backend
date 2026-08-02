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
 *           description: Статус проекта. Меняется вручную через PATCH, кроме одного автоматического перехода — сервер сам ставит "completed", когда завершён этап последнего агента маршрута. Не влияет на доступ к маршруту — это отражение состояния, а не гейт.
 *         currentAgentId:
 *           type: string
 *           nullable: true
 *           description: _id агента, который сейчас активен для этого проекта. У нового проекта проставляется при первом обращении к GET expert-route или POST expert-sessions (первый агент по order); null после прохождения всего маршрута.
 *         completedAgentIds:
 *           type: array
 *           items: { type: string }
 *           description: Список _id агентов, чьи этапы уже пройдены. Используется, чтобы показать статус "completed" в GET expert-route.
 *         contextSummary:
 *           type: string
 *           nullable: true
 *           description: Краткая сводка проекта, накапливаемая по мере прохождения этапов — после каждого завершённого этапа сюда дописывается summary его документа. Это единственное поле, которое всегда подмешивается в промпт любого агента.
 *         contextVersion:
 *           type: integer
 *           description: Счётчик версий contextSummary — увеличивается на 1 при каждом обновлении сводки.
 *         lastActivityAt:
 *           type: string
 *           format: date-time
 *           description: Дата последней активности по проекту — обновляется при завершении этапа.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания проекта.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения проекта.
 */
