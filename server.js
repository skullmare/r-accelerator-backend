import 'dotenv/config';
import app from './src/app.js';
import logger from './config/logger.config.js';
import db from './config/mongo.config.js'

const port = process.env.PORT || 3000;

try {
  await db.connectDB();

  app.listen(port, () => {
    logger.info(`Сервер запущен на localhost:${port}`);
  });
} catch (error) {
  logger.error('Ошибка при запуске сервера:', error);
  process.exit(1);
}