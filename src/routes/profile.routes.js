import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import profileSchemas from '../schemas/profile.schema.js';
import { getProfile } from '../controllers/profile/get-profile.controller.js';
import { updateProfile } from '../controllers/profile/update-profile.controller.js';

const router = express.Router();

router.get('/', authMiddleware, getProfile);
router.put('/', authMiddleware, validate(profileSchemas.updateProfileSchema), updateProfile);

export default router;
