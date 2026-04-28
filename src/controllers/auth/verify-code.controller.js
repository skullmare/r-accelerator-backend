import bcrypt from 'bcryptjs';
import User from '../../models/user.model.js';
import authService from '../../services/auth.service.js';

import { COOKIE_BASE, COOKIE_REFRESH, MAX_ATTEMPTS } from '../../constants/auth.constants.js';

export async function verificationCode(req, res) {
    const { email, code } = req.validatedData.body;

    const user = await User.findOne(
        { email },
        '+authCodeHashed +authCodeExpires +authCodeAttempts'
    );

    if (!user?.authCodeHashed || !user?.authCodeExpires) {
        return res.error({}, 400, 'Код не найден или истёк');
    }

    if (user.authCodeExpires < new Date()) {
        return res.error({}, 400, 'Срок действия кода истёк');
    }

    if (user.authCodeAttempts >= MAX_ATTEMPTS) {
        return res.error({}, 429, 'Превышено количество попыток');
    }

    const isValid = await bcrypt.compare(code, user.authCodeHashed);

    if (!isValid) {
        await User.updateOne({ email }, { $inc: { authCodeAttempts: 1 } });
        return res.error({}, 400, 'Неверный код');
    }

    await User.updateOne({ email }, {
        $set: { authCodeHashed: null, authCodeExpires: null, authCodeAttempts: 0, lastLogin: new Date() }
    });

    const { accessToken, refreshToken } = authService.generateTokens({ id: user._id, email: user.email });

    res.cookie('accessToken', accessToken, {
        ...COOKIE_BASE,
        expires: new Date(Date.now() + 15 * 60 * 1000),
    });
    res.cookie('refreshToken', refreshToken, {
        ...COOKIE_REFRESH,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return res.success({ id: user._id, email: user.email }, 'Авторизация прошла успешно', 200);
}