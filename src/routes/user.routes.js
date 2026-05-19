import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import userSchemas from '../schemas/user.schema.js';
import { listUsers } from '../controllers/user/list-users.controller.js';
import { getUser } from '../controllers/user/get-user.controller.js';
import { updateUser } from '../controllers/user/update-user.controller.js';
import { updateUserRole } from '../controllers/user/update-user-role.controller.js';

const router = express.Router();

router.get('/', authMiddleware, checkPermission('users.read'), listUsers);
router.get('/:id', authMiddleware, checkPermission('users.read'), validate(userSchemas.userIdSchema), getUser);
router.put('/:id/role', authMiddleware, checkPermission('users.update'), validate(userSchemas.updateUserRoleSchema), updateUserRole);
router.put('/:id', authMiddleware, checkPermission('users.update'), validate(userSchemas.updateUserSchema), updateUser);

export default router;
