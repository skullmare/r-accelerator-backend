/**
 * @swagger
 * components:
 *   schemas:
 *     StudyAgent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         role:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *         avatar:
 *           type: string
 *           format: uri
 *         openAiAssistantId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */
