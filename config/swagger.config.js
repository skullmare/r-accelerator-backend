import swaggerJsdoc from 'swagger-jsdoc';

const isDev = process.env.NODE_ENV === 'development';
const serverUrl = isDev
    ? `${process.env.HOST}:${process.env.PORT}/api/v1`
    : `${process.env.HOST}/api/v1`;

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Rocketmind API',
            version: '1.0.0',
            description:
                'API платформы Rocketmind.\n\n' +
                '**Формат ответа.** Все ответы оборачиваются в единый конверт ' +
                '(см. resify-express): успешный — `{ success: true, message, data }`, ' +
                'где `data` — это как раз то, что описано в схеме ответа каждого ' +
                'эндпоинта ниже; ошибка — `{ success: false, message, error: { code, description } }` ' +
                '(см. схему Error). Схемы ответов ниже всегда описывают именно ' +
                'содержимое поля `data`, а не тело ответа целиком.'
        },
        servers: [{ url: serverUrl }],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'accessToken'
                }
            }
        },
        security: [{ cookieAuth: [] }]
    },
    apis: ['./src/swagger/*.js', './src/routes/**/*.js']
};

export const swaggerSpec = swaggerJsdoc(options);
