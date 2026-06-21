/**
 * Нагрузочный тест: Study Lessons & Lesson Groups endpoints
 *
 * Требует: права study_lessons.read, study_lessons.create,
 *          study_lessons.update, study_lessons.delete
 *
 * Тестирует:
 *   GET    /api/v1/study/lessons
 *   POST   /api/v1/study/lessons
 *   GET    /api/v1/study/lessons/:id
 *   PATCH  /api/v1/study/lessons/:id
 *   DELETE /api/v1/study/lessons/:id
 *   GET    /api/v1/study/lesson-groups
 *   POST   /api/v1/study/lesson-groups
 *   PATCH  /api/v1/study/lesson-groups/:id
 *   DELETE /api/v1/study/lesson-groups/:id
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          k6/scenarios/study-lessons.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{endpoint:list_lessons}': ['p(95)<800'],
    'http_req_duration{endpoint:get_lesson}': ['p(95)<800'],
    'http_req_duration{endpoint:create_lesson}': ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

// Минимальный TipTap-совместимый JSON для поля content
const sampleContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Тестовый контент урока (k6 load test)' }],
    },
  ],
};

// Пример вопросов для урока с тестом
const sampleQuestions = [
  {
    questionText: 'Что такое нагрузочное тестирование?',
    answerOptions: [
      { text: 'Проверка производительности системы', isCorrect: true },
      { text: 'Тестирование интерфейса', isCorrect: false },
      { text: 'Проверка безопасности', isCorrect: false },
    ],
  },
];

export function setup() {
  const cookies = authenticate();
  if (!cookies) throw new Error('Аутентификация не удалась');
  return { cookies };
}

export default function ({ cookies }) {
  const params = authParams(cookies);
  let lessonId = null;

  group('Lessons — list & get', () => {
    const listRes = http.get(
      `${BASE_URL}/api/v1/study/lessons`,
      { ...params, tags: { endpoint: 'list_lessons' } }
    );
    check(listRes, {
      'lessons list: статус 200': (r) => r.status === 200,
    });

    try {
      const body = JSON.parse(listRes.body);
      const lessons = body.lessons || body;
      if (Array.isArray(lessons) && lessons.length > 0) lessonId = lessons[0]._id;
    } catch {}

    sleep(0.3);

    if (lessonId) {
      const getRes = http.get(
        `${BASE_URL}/api/v1/study/lessons/${lessonId}`,
        { ...params, tags: { endpoint: 'get_lesson' } }
      );
      check(getRes, {
        'lesson get: статус 200': (r) => r.status === 200,
        'lesson get: есть content': (r) => {
          try { return !!JSON.parse(r.body).content; }
          catch { return false; }
        },
      });
    }
  });

  sleep(0.5);

  group('Lesson Groups — CRUD', () => {
    // Список групп
    const listRes = http.get(
      `${BASE_URL}/api/v1/study/lesson-groups`,
      { ...params, tags: { endpoint: 'list_groups' } }
    );
    check(listRes, {
      'lesson groups list: статус 200': (r) => r.status === 200,
    });

    sleep(0.3);

    // Создание группы
    const groupName = `k6-group-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/study/lesson-groups`,
      JSON.stringify({ name: groupName }),
      { ...params, tags: { endpoint: 'create_group' } }
    );
    check(createRes, {
      'lesson group create: статус 201': (r) => r.status === 201,
    });

    let groupId = null;
    try { groupId = JSON.parse(createRes.body)._id; } catch {}

    sleep(0.3);

    if (groupId) {
      // Обновление группы
      http.patch(
        `${BASE_URL}/api/v1/study/lesson-groups/${groupId}`,
        JSON.stringify({ name: groupName + '-updated' }),
        { ...params, tags: { endpoint: 'patch_group' } }
      );

      sleep(0.3);

      // Удаление группы
      http.del(
        `${BASE_URL}/api/v1/study/lesson-groups/${groupId}`,
        null,
        { ...params, tags: { endpoint: 'delete_group' } }
      );
    }
  });

  sleep(0.5);

  group('Lessons — CRUD lifecycle', () => {
    // Создание урока
    const lessonName = `k6-lesson-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/study/lessons`,
      JSON.stringify({
        name: lessonName,
        content: sampleContent,
        questions: sampleQuestions,
      }),
      { ...params, tags: { endpoint: 'create_lesson' } }
    );
    check(createRes, {
      'lesson create: статус 201': (r) => r.status === 201,
    });

    let newId = null;
    try { newId = JSON.parse(createRes.body)._id; } catch {}

    if (!newId) { sleep(1); return; }

    sleep(0.3);

    // Обновление урока
    const patchRes = http.patch(
      `${BASE_URL}/api/v1/study/lessons/${newId}`,
      JSON.stringify({ name: lessonName + '-updated' }),
      { ...params, tags: { endpoint: 'patch_lesson' } }
    );
    check(patchRes, {
      'lesson patch: статус 200': (r) => r.status === 200,
    });

    sleep(0.3);

    // Удаление урока
    const deleteRes = http.del(
      `${BASE_URL}/api/v1/study/lessons/${newId}`,
      null,
      { ...params, tags: { endpoint: 'delete_lesson' } }
    );
    check(deleteRes, {
      'lesson delete: статус 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
