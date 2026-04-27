import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import User from './../../models/user.model.js';
import sendEmail from '../../services/email.service.js';
import emailVerificationTemplate from '../../templates/email/email-verification.js';

const CODE_TTL_MS = 15 * 60 * 1000;

async function sendCodeToEmail(req, res) {
    const validatedData = req.validatedData;

    // 1. Проверяем, есть ли пользователь с действительным кодом
    const existingUser = await User.findOne(
        { email: validatedData.body.email },
        '+authCodeExpires'
    );
    
    // Если пользователь существует И у него есть действительный код
    if (existingUser && existingUser.authCodeExpires && existingUser.authCodeExpires > new Date()) {
        return res.error(
            {}, 429, "Код подтверждения уже был отправлен. Пожалуйста, подождите перед повторной отправкой."
        );
    }

    // 2. Генерируем новый код
    const code = String(crypto.randomInt(100000, 999999));
    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(code, salt);

    // 3. Создаем или обновляем пользователя
    // Если пользователя нет - создастся новый (upsert: true)
    // Если есть и код истек - обновится
    const user = await User.findOneAndUpdate(
        { email: validatedData.body.email },
        {
            $set: {
                email: validatedData.body.email,
                authCodeHashed: hashedCode,
                authCodeExpires: new Date(Date.now() + CODE_TTL_MS),
                authCodeAttempts: 0
            }
        },
        {
            upsert: true,
            returnDocument: 'after'
        }
    );

    // 4. Отправляем email
    await sendEmail({
        email: user.email,
        subject: 'Код подтверждения входа — Rocketmind',
        html: emailVerificationTemplate(code)
    });

    return res.success(user, "Код подтверждения отправлен на почту", 200);
}

export default sendCodeToEmail;