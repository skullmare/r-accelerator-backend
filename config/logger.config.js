import winston from 'winston';

const logger = winston.createLogger({
  level: 'http',
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `Datetime: ${timestamp} / Level: ${level} / Message: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;