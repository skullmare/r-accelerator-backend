import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import expressWinston from 'express-winston';
import swaggerUi from 'swagger-ui-express';
import { attachHelpers, errorMiddleware } from 'resify-express';
import logger from '../config/logger.config.js';
import { swaggerSpec } from '../config/swagger.config.js';
import authRouter from './routes/auth.routes.js';
import profileRouter from './routes/profile.routes.js';
import userRouter from './routes/user.routes.js';
import roleRouter from './routes/role.routes.js';
import studyAgentRouter from './routes/study/agent.routes.js';
import studyProgramRouter from './routes/study/program.routes.js';
import studyMessageRouter from './routes/study/message.routes.js';
import fileRouter from './routes/file.routes.js';

const app = express();

const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = isDev ? [/^http:\/\/localhost:\d+$/] : ['https://agents.rocketmind.ru', 'https://admin.rocketmind.ru'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



app.use(attachHelpers);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(
    expressWinston.logger({
        winstonInstance: logger,
        meta: false,
        expressFormat: true,
    })
);

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/roles', roleRouter);
app.use('/api/v1/study/agents', studyAgentRouter);
app.use('/api/v1/study/programs', studyProgramRouter);
app.use('/api/v1/study/messages', studyMessageRouter);
app.use('/api/v1/file', fileRouter);

app.use((req, res) => {
    return res.error({}, 404, `Маршрут ${req.method} ${req.url} не найден`);
});

app.use(errorMiddleware({ includeStack: isDev }));

export default app;
