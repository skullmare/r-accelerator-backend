/**
 * @swagger
 * components:
 *   schemas:
 *     StudyMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         messageText:
 *           type: string
 *         user:
 *           type: string
 *         agent:
 *           type: string
 *         author:
 *           type: string
 *           enum: [user, agent]
 *         createdAt:
 *           type: string
 *           format: date-time
 *     OpenAiAssistant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 */
