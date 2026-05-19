import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import roleSchemas from '../schemas/role.schema.js';
import { listRoles } from '../controllers/role/list-roles.controller.js';
import { getRole } from '../controllers/role/get-role.controller.js';
import { createRole } from '../controllers/role/create-role.controller.js';
import { updateRole } from '../controllers/role/update-role.controller.js';
import { deleteRole } from '../controllers/role/delete-role.controller.js';

const router = express.Router();

router.get('/', authMiddleware, checkPermission('roles.read'), listRoles);
router.post('/', authMiddleware, checkPermission('roles.create'), validate(roleSchemas.createRoleSchema), createRole);
router.get('/:id', authMiddleware, checkPermission('roles.read'), validate(roleSchemas.roleIdSchema), getRole);
router.put('/:id', authMiddleware, checkPermission('roles.update'), validate(roleSchemas.updateRoleSchema), updateRole);
router.delete('/:id', authMiddleware, checkPermission('roles.delete'), validate(roleSchemas.roleIdSchema), deleteRole);

export default router;
