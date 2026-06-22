import User from '../models/user.model.js';

export async function createUser(overrides = {}) {
    return User.create({
        email: `user_${Date.now()}@test.com`,
        ...overrides
    });
}

export async function createUserInProgram(programId, overrides = {}) {
    return createUser({ studyPrograms: [programId], ...overrides });
}
