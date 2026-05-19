import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { checkPermission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import groupSchemas from '../../schemas/course/group.schema.js';
import { createGroup } from '../../controllers/course/group/create-group.controller.js';
import { getGroup } from '../../controllers/course/group/get-group.controller.js';
import { listGroups } from '../../controllers/course/group/list-groups.controller.js';
import { updateGroup } from '../../controllers/course/group/update-group.controller.js';
import { deleteGroup } from '../../controllers/course/group/delete-group.controller.js';
import { addToGroup } from '../../controllers/course/group/add-to-group.controller.js';

const router = express.Router();

router.post('/join', authMiddleware, validate(groupSchemas.addToGroupSchema), addToGroup);
router.get('/', authMiddleware, checkPermission('course_groups.read'), listGroups);
router.post('/', authMiddleware, checkPermission('course_groups.create'), validate(groupSchemas.createGroupSchema), createGroup);
router.get('/:id', authMiddleware, checkPermission('course_groups.read'), validate(groupSchemas.groupIdSchema), getGroup);
router.put('/:id', authMiddleware, checkPermission('course_groups.update'), validate(groupSchemas.updateGroupSchema), updateGroup);
router.delete('/:id', authMiddleware, checkPermission('course_groups.delete'), validate(groupSchemas.groupIdSchema), deleteGroup);

export default router;
