import User from '../models/user.model.js';

export const checkPermission = (permission) => async (req, res, next) => {
    const user = await User.findById(req.user.id, 'role').populate('role', 'permissions');

    if (!user?.role?.permissions?.includes(permission)) {
        return res.error({}, 403, 'Недостаточно прав');
    }

    next();
};
