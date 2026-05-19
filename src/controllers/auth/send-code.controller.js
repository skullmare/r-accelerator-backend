import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import User from './../../models/user.model.js';
import sendEmail from '../../services/email.service.js';
import emailVerificationTemplate from '../../templates/email/email-verification.js';

import { CODE_TTL_MS } from '../../constants/auth.constants.js';

export async function sendCodeToEmail(req, res) {
    try {
        const validatedData = req.validatedData;

        const existingUser = await User.findOne(
            { email: validatedData.body.email },
            '+authCodeExpires'
        );

        if (existingUser && existingUser.authCodeExpires && existingUser.authCodeExpires > new Date()) {
            return res.error(
                {}, 429, "Код подтверждения уже был отправлен. Пожалуйста, подождите перед повторной отправкой."
            );
        }

        const code = String(crypto.randomInt(100000, 999999));
        const salt = await bcrypt.genSalt(10);
        const hashedCode = await bcrypt.hash(code, salt);

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

        try {
            await sendEmail({
                email: user.email,
                subject: 'Код подтверждения входа — Rocketmind',
                html: emailVerificationTemplate(code)
            });
        } catch (emailError) {
            await User.findOneAndUpdate(
                { email: validatedData.body.email },
                {
                    $set: {
                        email: validatedData.body.email,
                        authCodeHashed: null,
                        authCodeExpires: null,
                        authCodeAttempts: 0
                    },
                },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            );
            return res.error({}, 429, "Ошибка отправки письма.");
        }

        return res.success(user, "Код подтверждения отправлен на почту", 200);
    } catch (error) {
        return res.error({}, 500, 'Ошибка при отправке кода подтверждения');
    }
}