const emailVerificationTemplate = (code) => {
    const currentYear = new Date().getFullYear();
    
    return `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Код подтверждения Rocketmind</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f5f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <!-- Основной контейнер для почтовых клиентов -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fb;">
                <tr>
                    <td align="center" style="padding:40px 20px;">
                        <!-- Центральный блок с ограниченной шириной -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%; background-color:#ffffff; border-radius:24px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
                            
                            <!-- Шапка с брендом -->
                            <tr>
                                <td style="padding:32px 32px 0 32px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding-bottom:8px;">
                                                <span style="font-size:28px; font-weight:800; letter-spacing:-0.5px; background: linear-gradient(135deg, #0F2027, #203A43, #2C5364); -webkit-background-clip:text; background-clip:text; color:transparent;">Rocketmind</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <span style="font-size:14px; font-weight:600; color:#4B9CD3; text-transform:uppercase; letter-spacing:1.5px;">Подтверждение входа</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Основной контент -->
                            <tr>
                                <td style="padding:32px;">
                                    
                                    <!-- Приветствие -->
                                    <p style="margin:0 0 12px 0; font-size:24px; font-weight:600; color:#1E2A3A; line-height:1.3;">
                                        Здравствуйте!
                                    </p>
                                    
                                    <p style="margin:0 0 28px 0; font-size:15px; color:#5A6E7F; line-height:1.5;">
                                        Мы получили запрос на вход в ваш аккаунт. Используйте код ниже, чтобы подтвердить действие.
                                    </p>

                                    <!-- Блок с кодом (основной акцент) -->
                                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFE; border-radius:16px; border:1px solid #E2E8F0; margin-bottom:28px;">
                                        <tr>
                                            <td align="center" style="padding:28px 20px;">
                                                <span style="font-size:42px; font-weight:700; letter-spacing:8px; color:#1E2A3A; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background-color:#ffffff; padding:12px 20px; border-radius:12px; display:inline-block; border:1px solid #E2E8F0; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                                                    ${code}
                                                </span>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Информационная сетка (адаптивная) -->
                                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                                        <tr>
                                            <td width="48%" style="background-color:#F8FAFE; padding:16px; border-radius:12px; border:1px solid #E2E8F0;">
                                                <table width="100%">
                                                    <tr>
                                                        <td style="padding-bottom:6px;">
                                                            <span style="font-size:12px; font-weight:600; color:#7F8C9A; text-transform:uppercase; letter-spacing:0.5px;">⏱ Действителен</span>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <span style="font-size:18px; font-weight:700; color:#1E2A3A;">15 минут</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                            <td width="4%"></td>
                                            <td width="48%" style="background-color:#F8FAFE; padding:16px; border-radius:12px; border:1px solid #E2E8F0;">
                                                <table width="100%">
                                                    <tr>
                                                        <td style="padding-bottom:6px;">
                                                            <span style="font-size:12px; font-weight:600; color:#7F8C9A; text-transform:uppercase; letter-spacing:0.5px;">🔐 Попытки ввода</span>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>
                                                            <span style="font-size:18px; font-weight:700; color:#1E2A3A;">3 из 3</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Предупреждение о безопасности -->
                                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF5F0; border-left:4px solid #E67E22; border-radius:8px; margin-bottom:16px;">
                                        <tr>
                                            <td style="padding:16px 20px;">
                                                <p style="margin:0; font-size:14px; color:#C0611B; line-height:1.5;">
                                                    ⚠️ <strong>Вы не запрашивали код?</strong> Ваш аккаунт может быть в опасности. Немедленно <a href="${process.env.RESET_PASSWORD_URL}" style="color:#E67E22; text-decoration:underline;">смените пароль</a> и свяжитесь со службой поддержки.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Дополнительная заметка -->
                                    <p style="margin:20px 0 0 0; font-size:12px; color:#A0AEC0; text-align:center; line-height:1.4;">
                                        Никогда не передавайте этот код третьим лицам. Сотрудники Rocketmind <strong style="color:#1E2A3A;">никогда не спросят</strong> у вас этот код.
                                    </p>

                                </td>
                            </tr>

                            <!-- Футер -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFE; border-top:1px solid #E2E8F0;">
                                <tr>
                                    <td style="padding:24px 32px 32px 32px;">
                                        <p style="margin:0 0 12px 0; font-size:12px; color:#A0AEC0; line-height:1.4;">
                                            Это автоматическое сообщение, отправленное сервисом Rocketmind. Пожалуйста, не отвечайте на него.
                                        </p>
                                        <p style="margin:0; font-size:12px; color:#A0AEC0;">
                                            © ${currentYear} Rocketmind. Все права защищены.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};

export default emailVerificationTemplate;