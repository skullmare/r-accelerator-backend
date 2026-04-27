
import nodemailer from 'nodemailer';
import logger from '../../config/logger.config.js';

const sendEmail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_PORT == 465, 
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html,
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info('Письмо с кодом для авторизации успешно отправлено');
        return info;
    } catch (error) {
        logger.error('Ошибка отправки письма с кодом авторизации:', error);
    }
};

export default sendEmail;