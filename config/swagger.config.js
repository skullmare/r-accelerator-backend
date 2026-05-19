import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Rocketmind API',
            version: '1.0.0',
            description: 'API платформы Rocketmind — модуль Course'
        },
        servers: [{ url: '/api/v1' }],
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
