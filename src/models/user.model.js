import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Пожалуйста, введите корректный email']
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
    }
}, {
    timestamps: true 
});

const User = mongoose.model('User', UserSchema);
export default User;