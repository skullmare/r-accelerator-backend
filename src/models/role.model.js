import mongoose from 'mongoose';
import { ALL_PERMISSIONS } from '../constants/permissions.constants.js';

const RoleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    permissions: {
        type: [String],
        enum: ALL_PERMISSIONS,
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: 'Список прав не может быть пустым'
        }
    },
    isSystem: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Role = mongoose.model('Role', RoleSchema);
export default Role;