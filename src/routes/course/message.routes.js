import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import messageSchemas from '../../schemas/course/message.schema.js';
import { createMessage } from '../../controllers/course/message/create-message.controller.js';
import { listMessages } from '../../controllers/course/message/list-messages.controller.js';

const router = express.Router();

router.get('/', authMiddleware, validate(messageSchemas.listMessagesSchema), listMessages);
router.post('/', authMiddleware, validate(messageSchemas.createMessageSchema), createMessage);

export default router;
