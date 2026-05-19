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
 *         profession:
 *           type: string
 *         fieldOfActivity:
 *           type: string
 *         city:
 *           type: string
 *         role:
 *           $ref: '#/components/schemas/Role'
 *         courseGroup:
 *           $ref: '#/components/schemas/CourseGroup'
 *         lastLogin:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     Role:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *         isSystem:
 *           type: boolean
 *     CourseAgent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         avatar:
 *           type: string
 *           format: uri
 *         openAiAssistantId:
 *           type: string
 *         baseMessages:
 *           type: array
 *           items:
 *             type: string
 *     CourseGroup:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         agents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CourseAgent'
 *         active:
 *           type: boolean
 *         qrCode:
 *           type: string
 *     CourseMessage:
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
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 */
