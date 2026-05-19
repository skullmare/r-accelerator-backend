import Role from '../models/role.model.js';
import { ALL_PERMISSIONS } from '../constants/permissions.constants.js';
import logger from '../../config/logger.config.js';

export async function initSuperadminRole() {
    await Role.findOneAndUpdate(
        { name: 'superadmin' },
        { name: 'superadmin', permissions: ALL_PERMISSIONS, isSystem: true },
        { upsert: true, returnDocument: 'after' }
    );
    logger.info('Роль superadmin инициализирована');
}
