import 'dotenv/config';
import app from './src/app.js';
import logger from './config/logger.config.js';
import db from './config/mongo.config.js';
import { initSuperadminRole } from './src/init/role-superadmin.init.js';
import { initSuperadmin } from './src/init/superadmin.init.js';

const port = process.env.PORT || 3000;

try {
    await db.connectDB();
    await initSuperadminRole();
    await initSuperadmin();

    app.listen(port, () => {
        logger.info(`Сервер запущен на localhost:${port}`);
    });
} catch (error) {
    logger.error('Ошибка при запуске сервера:', error);
    process.exit(1);
}
