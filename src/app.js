import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import expressWinston from 'express-winston';
import { attachHelpers, errorMiddleware } from 'resify-express';
import logger from '../config/logger.config.js';
import authRouter from './routes/auth.routes.js';


const app = express();

const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = isDev ? ['http://localhost:5173'] : ['https://production.domain.ru'];

app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  expressWinston.logger({
    winstonInstance: logger,
    meta: false,
    expressFormat: true,
  })
);

app.use(attachHelpers);


app.use('/api/v1/auth', authRouter)


app.use((req, res) => {
  return res.error({}, 404, `Маршрут ${req.method} ${req.url} не найден`);
});

app.use(errorMiddleware({ includeStack: isDev }));


export default app;