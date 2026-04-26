import 'dotenv/config';
import express from 'express';
import expressWinston from 'express-winston';
import logger from './config/logger.config.js';

const app = express();

app.use(
  expressWinston.logger({
    winstonInstance: logger,
    meta: false,
    expressFormat: true,
  })
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`Сервер запущен на localhost:${port}`);
});

export default app;