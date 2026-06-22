import crypto from 'crypto';
import StudyProgram from '../models/study/program.model.js';
import StudyLesson from '../models/study/lesson.model.js';
import StudyAgent from '../models/study/agent.model.js';

export async function createLesson(overrides = {}) {
    return StudyLesson.create({
        name: 'Test Lesson',
        content: { type: 'doc', content: [] },
        questions: [],
        ...overrides
    });
}

export async function createLessonWithQuestions(overrides = {}) {
    return StudyLesson.create({
        name: 'Test Lesson With Questions',
        content: { type: 'doc', content: [] },
        questions: [
            {
                questionText: 'Question 1',
                answerOptions: [
                    { text: 'Wrong answer', isCorrect: false },
                    { text: 'Correct answer', isCorrect: true }
                ]
            },
            {
                questionText: 'Question 2',
                answerOptions: [
                    { text: 'Correct answer', isCorrect: true },
                    { text: 'Wrong answer', isCorrect: false }
                ]
            }
        ],
        ...overrides
    });
}

export async function createAgent(overrides = {}) {
    return StudyAgent.create({
        name: 'Test Agent',
        description: 'Test description',
        avatar: 'https://example.com/avatar.png',
        openAiAssistantId: 'asst_test123',
        ...overrides
    });
}

export async function createProgram(overrides = {}) {
    const { modules = [], ...rest } = overrides;
    return StudyProgram.create({
        name: 'Test Program',
        sequential: true,
        active: true,
        qrCode: crypto.randomBytes(16).toString('hex'),
        modules,
        ...rest
    });
}

export async function createProgramWithItems({ sequential = true } = {}) {
    const lesson1 = await createLesson({ name: 'Lesson 1' });
    const lesson2 = await createLesson({ name: 'Lesson 2' });
    const agent = await createAgent({ name: 'Agent 1' });

    const program = await createProgram({
        sequential,
        modules: [{
            name: 'Module 1',
            items: [
                { type: 'StudyLesson', item: lesson1._id },
                { type: 'StudyAgent', item: agent._id },
                { type: 'StudyLesson', item: lesson2._id }
            ]
        }]
    });

    return { program, lesson1, lesson2, agent };
}
