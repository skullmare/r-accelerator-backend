import logger from '../../config/logger.config.js';

const stringify = (value) => {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const describePayload = ({ code = null, description = null, error = null } = {}) => {
    const parts = [];

    if (code) parts.push(`code: ${stringify(code)}`);
    if (description) parts.push(`description: ${stringify(description)}`);
    if (error) parts.push(`error: ${stringify(error)}`);

    return parts.join(' / ');
};

// Оборачивает res.error (из resify-express), чтобы текст каждой ошибки,
// отданной клиенту, попадал в лог, а не только строка запроса со статусом.
export function logErrorResponses(req, res, next) {
    const sendError = res.error.bind(res);

    res.error = (payload = {}, status = 500, message = 'Error') => {
        const details = describePayload(payload);
        const line = `${req.method} ${req.originalUrl} ${status} / ${message}${details ? ` / ${details}` : ''}`;

        if (status >= 500) {
            logger.error(line);
        } else {
            logger.warn(line);
        }

        return sendError(payload, status, message);
    };

    next();
}

// Логирует необработанные ошибки (со стеком) до того, как их обработает errorMiddleware.
export function logThrownErrors(error, req, res, next) {
    const status = error.status || 500;

    logger.error(`${req.method} ${req.originalUrl} ${status} / ${error.message}`, { stack: error.stack });

    return next(error);
}
