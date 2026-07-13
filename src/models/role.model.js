import mongoose from 'mongoose';
import { ALL_PERMISSIONS } from '../constants/permissions.constants.js';

const RoleSchema = new mongoose.Schema({
    // Название роли, отображается в админке при управлении ролями.
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Список прав из общего справочника ALL_PERMISSIONS
    // (permissions.constants.js). checkPermission.middleware.js читает
    // именно этот массив у role пользователя, чтобы решить, пускать ли
    // его на конкретный эндпоинт.
    permissions: {
        type: [String],
        enum: ALL_PERMISSIONS
    },
    // Помечает служебные роли (сейчас — только 'superadmin', создаваемая
    // init/role-superadmin.init.js со всеми правами сразу). Системную роль
    // нельзя удалить или отредактировать (role/delete-role.controller.js,
    // role/update-role.controller.js явно это проверяют).
    isSystem: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Role = mongoose.model('Role', RoleSchema);
export default Role;
