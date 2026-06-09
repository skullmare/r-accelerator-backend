/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         profession:
 *           type: string
 *         fieldOfActivity:
 *           type: string
 *         city:
 *           type: string
 *         isSystem:
 *           type: boolean
 *         role:
 *           type: object
 *           nullable: true
 *           description: Популяция роли. GET /users возвращает только _id+name, GET /users/:id и GET /profile возвращают _id+name+permissions
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             permissions:
 *               type: array
 *               items:
 *                 type: string
 *         studyPrograms:
 *           type: array
 *           description: Краткие данные программ пользователя (только _id и name)
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               name:
 *                 type: string
 *         lastLogin:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
