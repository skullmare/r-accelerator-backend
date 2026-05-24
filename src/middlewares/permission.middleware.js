import User from '../models/user.model.js';

// mode: 'all' — нужны все права, 'any' — достаточно одного
export const checkPermission = (permissions, mode = 'all') => async (req, res, next) => {
    const user = await User.findById(req.user.id, 'role').populate('role', 'permissions');
    const userPermissions = user?.role?.permissions ?? [];

    const list = Array.isArray(permissions) ? permissions : [permissions];

    const hasAccess = mode === 'any'
        ? list.some(p => userPermissions.includes(p))
        : list.every(p => userPermissions.includes(p));

    if (!hasAccess) {
        return res.error({}, 403, 'Недостаточно прав');
    }

    next();
};
