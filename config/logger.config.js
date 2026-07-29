import winston from 'winston';

const logger = winston.createLogger({
    level: 'http',
    format: winston.format.combine(
        // Разворачивает объекты Error (logger.error(error)) в текст ошибки и стек:
        // без этого в логе оставался бы пустой Message.
        winston.format.errors({ stack: true }),
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            const line = `Datetime: ${timestamp} / Level: ${level} / Message: ${message}`;
            return stack ? `${line}\n${stack}` : line;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

export default logger;
