/**
 * @swagger
 * components:
 *   schemas:
 *     AcceleratorAgent:
 *       type: object
 *       description: |
 *         Агент Акселератора — то, что видит администратор. Полей ровно
 *         столько, сколько нужно, чтобы агент гарантированно провёл этап:
 *         два промпта, знания, четыре отображаемых поля и два системных.
 *         Параметры LLM и сборки контекста одинаковы для всех агентов и
 *         задаются в config/accelerator.config.js, а не у агента.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор агента — единственный способ на него сослаться.
 *         systemPrompt:
 *           type: string
 *           description: Основная инструкция агента. Уходит в LLM первым блоком системного промпта при каждом сообщении и при генерации документа этапа. Видна только пользователям с правом accelerator_agents.manage.
 *         completionPrompt:
 *           type: string
 *           description: Условие завершения этапа обычным текстом (не схема). Показывается агенту в системном промпте на каждом ходу; выполнив его, агент вызывает инструмент stage_ready, и сессия получает readyForArtifact=true.
 *         knowledgeIds:
 *           type: array
 *           items: { type: string }
 *           description: _id баз знаний (Knowledge), закреплённых за агентом. Поиск в knowledge_context идёт только по ним; пустой список — агент работает без базы знаний.
 *         name:
 *           type: string
 *           description: Имя агента для интерфейса ("Роман"). В промпт не подмешивается.
 *         description:
 *           type: string
 *           nullable: true
 *           maxLength: 1000
 *           description: Описание специализации для интерфейса ("Эксперт по рынку и нише"). В промпт не подмешивается, но используется как подзаголовок PDF-документа этапа.
 *         avatarUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: Аватарка агента для UI.
 *         thinkingAvatarUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: Аватарка состояния «агент думает» (пока модель формирует ответ).
 *         order:
 *           type: integer
 *           description: Порядковый номер агента. Маршрут пользователя — это агенты, отсортированные по order, поэтому первый агент и переход «дальше» считаются по нему.
 *         nextAgentId:
 *           type: string
 *           nullable: true
 *           description: Необязательное переопределение перехода для нелинейного маршрута. Если не задан (или указывает на удалённого агента) — после этапа проект переходит к следующему агенту по order.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
