/**
 * @swagger
 * components:
 *   schemas:
 *     LessonGroup:
 *       type: object
 *       description: Организационная группа для группировки уроков в интерфейсе — собственной логики доступа/прогресса не несёт (см. StudyLesson.group).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор группы.
 *         name:
 *           type: string
 *           description: Название группы, отображается в списке уроков.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания группы.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения группы. В ответе GET /study/lesson-groups не возвращается (там используется урезанная проекция полей) — присутствует только в ответах create/update.
 */
