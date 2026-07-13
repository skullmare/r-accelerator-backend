/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       description: Роль пользователя — набор прав, проверяемых checkPermission.middleware.js.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор роли.
 *         name:
 *           type: string
 *           description: Название роли, отображается в админке.
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: Список прав из справочника ALL_PERMISSIONS (см. GET /roles/permissions).
 *         isSystem:
 *           type: boolean
 *           description: Служебная роль (сейчас — только superadmin). Такую роль нельзя удалить или отредактировать.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания роли.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения роли.
 */
