import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import expressWinston from 'express-winston';
import swaggerUi from 'swagger-ui-express';
import { attachHelpers, errorMiddleware } from 'resify-express';
import logger from '../config/logger.config.js';
import { logErrorResponses, logThrownErrors } from './middlewares/error-logger.middleware.js';
import { swaggerSpec } from '../config/swagger.config.js';
import authRouter from './routes/auth.routes.js';
import profileRouter from './routes/profile.routes.js';
import userRouter from './routes/user.routes.js';
import roleRouter from './routes/role.routes.js';
import studyAgentRouter from './routes/study/agent.routes.js';
import studyProgramRouter from './routes/study/program.routes.js';
import studyLessonRouter from './routes/study/lesson.routes.js';
import studyLessonGroupRouter from './routes/study/lesson-group.routes.js';
import studyProgressRouter from './routes/study/progress.routes.js';
import fileRouter from './routes/file.routes.js';
import projectRouter from './routes/accelerator/project.routes.js';
import acceleratorAgentRouter from './routes/accelerator/agent.routes.js';
import acceleratorKnowledgeRouter from './routes/accelerator/knowledge.routes.js';
import systemRouter from './routes/system.routes.js';

const app = express();

const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = isDev ? [/^http:\/\/localhost:\d+$/] : ['https://agents.rocketmind.ru', 'https://admin.rocketmind.ru', 'https://rocketmind-saas-rocketmind.amvera.io'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



app.use(attachHelpers);
app.use(logErrorResponses);

app.get('/api/docs/swagger.json', (req, res) => res.json(swaggerSpec));
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
app.use('/api/v1/study/lessons', studyLessonRouter);
app.use('/api/v1/study/lesson-groups', studyLessonGroupRouter);
app.use('/api/v1/study/programs', studyProgressRouter);
app.use('/api/v1/file', fileRouter);
app.use('/api/v1/accelerator/projects', projectRouter);
app.use('/api/v1/accelerator/admin/agents', acceleratorAgentRouter);
app.use('/api/v1/accelerator/admin/knowledge', acceleratorKnowledgeRouter);
app.use('/api/v1/system', systemRouter);

app.use((req, res) => {
    return res.error({}, 404, `Маршрут ${req.method} ${req.url} не найден`);
});

app.use(logThrownErrors);
app.use(errorMiddleware({ includeStack: isDev }));

export default app;
