import 'dotenv/config';
import app from './src/app.js';
import logger from './config/logger.config.js';
import db from './config/mongo.config.js';
import { initSuperadminRole } from './src/init/role-superadmin.init.js';
import { initSuperadmin } from './src/init/superadmin.init.js';
import { migrateCourseGroupToStudyPrograms } from './src/init/migrate-course-group.init.js';
import { registerHandler, startWorker } from './src/services/queue/worker.js';
import { FILE_PROCESS_JOB_TYPE, processFile } from './src/services/file-processing/process-file.job.js';

const port = process.env.PORT || 3000;

try {
    await db.connectDB();
    await initSuperadminRole();
    await initSuperadmin();
    await migrateCourseGroupToStudyPrograms();

    registerHandler(FILE_PROCESS_JOB_TYPE, processFile);
    startWorker();

    app.listen(port, () => {
        logger.info(`Сервер запущен на localhost:${port}`);
    });
} catch (error) {
    logger.error('Ошибка при запуске сервера:', error);
    process.exit(1);
}
