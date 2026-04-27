import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import User from './../../models/user.model.js';
import sendEmail from '../../services/email.service.js';
import emailVerificationTemplate from '../../templates/email/email-verification.js';

async function sendCodeToEmail(req, res) {
    const validatedData = req.validatedData;

    const user = await User.findOneAndUpdate(
        { email: validatedData.body.email },
        { email: validatedData.body.email },
        {
            upsert: true,
            returnDocument: 'after'
        }
    );

    const code = String(crypto.randomInt(100000, 999999));
    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(code, salt);

    await User.findByIdAndUpdate(user._id, {
        authCodeHashed: hashedCode,
        authCodeExpires: new Date(),
        authCodeAttempts: 0
    })

    await sendEmail({
        email: user.email,
        subject: 'Код подтверждения входа — Rocketmind',
        html: emailVerificationTemplate(123456)
    })

    return res.success(user, "Код подтверждения отправлен на почту", 200)
}

export default sendCodeToEmail;