import mongoose from 'mongoose';
import logger from './logger.config.js';

const connectDB = async () => {
    try {
        mongoose.connection.on('open', () => {
            logger.info('MongoDB подключена');
        });

        mongoose.connection.on('error', (error) => {
            logger.error('Ошибка подключения к MongoDB');
        });

        mongoose.connection.on('disconnected', () => {
            logger.error('MongoDB отключена');
        });

        const conn = await mongoose.connect(process.env.MONGODB_URI, {});

        return conn;
    } catch (error) {
        logger.error('Ошибка подключения к MongoDB');
        process.exit(1);
    }
};

const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        logger.info('MongoDB соединение закрыто');
    } catch (error) {
        logger.error('Ошибка при закрытии базы данных MongoDB');
    }
};

export default { connectDB, disconnectDB };