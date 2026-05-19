import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import expressWinston from 'express-winston';
import { attachHelpers, errorMiddleware } from 'resify-express';
import logger from '../config/logger.config.js';
import authRouter from './routes/auth.routes.js';
import courseAgentRouter from './routes/course/agent.routes.js';
import courseGroupRouter from './routes/course/group.routes.js';
import courseMessageRouter from './routes/course/message.routes.js';
import fileRouter from './routes/file.routes.js';

const app = express();

const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = isDev ? [/^http:\/\/localhost:\d+$/] : [/^http:\/\/localhost:\d+$/];

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

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/course/agents', courseAgentRouter);
app.use('/api/v1/course/groups', courseGroupRouter);
app.use('/api/v1/course/messages', courseMessageRouter);
app.use('/api/v1/upload', fileRouter);

app.use((req, res) => {
    return res.error({}, 404, `Маршрут ${req.method} ${req.url} не найден`);
});

app.use(errorMiddleware({ includeStack: isDev }));

export default app;
