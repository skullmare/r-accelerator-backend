import mongoose from 'mongoose';

// используем реальное подключение из env или тестовую строку
const MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

export async function connect() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
    }
}

export async function closeDatabase() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
}

export async function clearDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
}
