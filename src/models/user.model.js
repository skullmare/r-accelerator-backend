import mongoose from "mongoose";
import { type } from "os";

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Пожалуйста, введите корректный email']
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    firstName: {
        type: String
    },
    profession: {
        type: String
    },
    fieldOfActivity: {
        type: String
    },
    city: {
        type: String
    },
    courseGroup: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseGroup'
    },
    openAiThreadId: {
        type: String
    },
    authCodeHashed: {
        type: String,
        required: false,
        default: null,
        select: false
    },
    authCodeExpires: { 
        type: Date,
        required: false,
        default: null,
        select: false
    },
    authCodeAttempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 3,
        select: false
    },
    lastLogin: {
        type: Date
    },
    isSystem: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true 
});

const User = mongoose.model('User', UserSchema);
export default User;