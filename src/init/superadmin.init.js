import User from '../models/user.model.js';
import Role from '../models/role.model.js';
import logger from '../../config/logger.config.js';

export async function initSuperadmin() {
    const email = process.env.SUPERADMIN_EMAIL;
    if (!email) return;

    const existing = await User.findOne({ email });
    if (existing) return;

    const role = await Role.findOne({ name: 'superadmin' });
    await User.create({ email, role: role._id, isSystem: true });
    logger.info('Суперадмин создан');
}
