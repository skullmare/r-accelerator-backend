import 'dotenv/config';
import app from './src/app.js';
import logger from './config/logger.config.js';
import db from './config/mongo.config.js';
import { initSuperadminRole } from './src/init/role-superadmin.init.js';
import { initSuperadmin } from './src/init/superadmin.init.js';
import { migrateCourseGroupToStudyPrograms } from './src/init/migrate-course-group.init.js';
import { logLlmHealthOnStartup } from './src/init/llm-health.init.js';

const port = process.env.PORT || 3000;

try {
    await db.connectDB();
    await initSuperadminRole();
    await initSuperadmin();
    await migrateCourseGroupToStudyPrograms();

    app.listen(port, () => {
        logger.info(`Сервер запущен на localhost:${port}`);

        // Проверка провайдеров идёт ПОСЛЕ listen и без await: сервер не должен
        // ждать сеть, чтобы начать принимать запросы, и тем более не должен
        // падать из-за недоступного LLM.
        logLlmHealthOnStartup();
    });
} catch (error) {
    logger.error('Ошибка при запуске сервера:', error);
    process.exit(1);
}
