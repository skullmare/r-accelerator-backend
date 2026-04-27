import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import User from './../../models/user.model.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAIN_DOMAIN = process.env.MAIN_DOMAIN;

async function verificationCode(req, res) {
    const validatedData = req.validatedData;


    return res.success({}, "Код подтверждения отправлен на почту", 200);
}

export default verificationCode;