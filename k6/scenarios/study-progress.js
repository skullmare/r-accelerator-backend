/**
 * Нагрузочный тест: Student flow — Progress endpoints
 *
 * Симулирует типичный сценарий студента:
 *   1. Просмотр программ (GET /api/v1/study/programs)
 *   2. Вступление в программу (POST /api/v1/study/programs/join)
 *   3. Просмотр прогресса (GET /api/v1/study/programs/:id/progress)
 *   4. Открытие урока (GET /api/v1/study/programs/:programId/lessons/:lessonId)
 *   5. Завершение урока с ответами (POST /api/v1/study/programs/:id/lessons/:lessonId/complete)
 *   6. Просмотр агента (GET /api/v1/study/programs/:programId/agents/:agentId)
 *   7. История сообщений агента (GET .../agents/:agentId/messages)
 *
 * Переменные окружения:
 *   K6_AUTH_COOKIES   — куки авторизации
 *   QR_CODE           — QR-код для вступления в программу (обязателен для join)
 *   PROGRAM_ID        — ID программы (если уже вступили)
 *   LESSON_ID         — ID урока в программе
 *   AGENT_ID          — ID агента в программе
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          -e QR_CODE="<qr-code>" \
 *          -e PROGRAM_ID="<id>" \
 *          -e LESSON_ID="<id>" \
 *          k6/scenarios/study-progress.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{endpoint:progress}': ['p(95)<1000'],
    'http_req_duration{endpoint:open_lesson}': ['p(95)<1000'],
    'http_req_duration{endpoint:complete_lesson}': ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const joinErrors = new Counter('join_program_errors');
const completeErrors = new Counter('complete_lesson_errors');

export function setup() {
  const cookies = authenticate();
  if (!cookies) throw new Error('Аутентификация не удалась');

  return {
    cookies,
    programId: __ENV.PROGRAM_ID || null,
    lessonId: __ENV.LESSON_ID || null,
    agentId: __ENV.AGENT_ID || null,
    qrCode: __ENV.QR_CODE || null,
  };
}

export default function (data) {
  const { cookies } = data;
  const params = authParams(cookies);

  let programId = data.programId;
  let lessonId = data.lessonId;
  let agentId = data.agentId;

  group('Join program', () => {
    if (!data.qrCode) return;

    const res = http.post(
      `${BASE_URL}/api/v1/study/programs/join`,
      JSON.stringify({ qrCode: data.qrCode }),
      { ...params, tags: { endpoint: 'join' } }
    );

    const ok = check(res, {
      'join: статус 200 или 409': (r) => [200, 409].includes(r.status),
    });
    if (!ok) joinErrors.add(1);

    // Ответ: { success, data: { programId } }
    if (!programId) {
      try {
        const b = JSON.parse(res.body);
        programId = b.data?.programId || b.programId;
      } catch {}
    }
  });

  sleep(0.5);

  if (!programId) {
    sleep(1);
    return;
  }

  group('View program progress', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/study/programs/${programId}/progress`,
      { ...params, tags: { endpoint: 'progress' } }
    );

    check(res, {
      'progress: статус 200': (r) => r.status === 200,
      'progress: есть modules': (r) => {
        try {
          const b = JSON.parse(r.body);
          return Array.isArray(b.data?.modules || b.modules);
        } catch { return false; }
      },
    });

    // Ответ: { data: { modules: [...] } }
    try {
      const b = JSON.parse(res.body);
      const modules = b.data?.modules || b.modules || [];
      for (const mod of modules) {
        for (const item of mod.items || []) {
          if (item.accessible && item.type === 'StudyLesson' && !lessonId) {
            lessonId = item.item?._id || item.item;
          }
          if (item.accessible && item.type === 'StudyAgent' && !agentId) {
            agentId = item.item?._id || item.item;
          }
        }
      }
    } catch {}
  });

  sleep(0.5);

  if (lessonId) {
    group('Open & complete lesson', () => {
      // Открытие урока
      const openRes = http.get(
        `${BASE_URL}/api/v1/study/programs/${programId}/lessons/${lessonId}`,
        { ...params, tags: { endpoint: 'open_lesson' } }
      );

      check(openRes, {
        'lesson open: статус 200': (r) => r.status === 200,
        'lesson open: есть content': (r) => {
          try {
            const b = JSON.parse(r.body);
            return !!(b.data?.content || b.content);
          } catch { return false; }
        },
      });

      sleep(1);

      // Завершение урока
      const completeRes = http.post(
        `${BASE_URL}/api/v1/study/programs/${programId}/lessons/${lessonId}/complete`,
        null,
        { ...params, tags: { endpoint: 'complete_lesson' } }
      );

      const ok = check(completeRes, {
        'lesson complete: статус 200 или 409': (r) => [200, 409].includes(r.status),
      });
      if (!ok) completeErrors.add(1);
    });

    sleep(0.5);
  }

  if (agentId) {
    group('Agent — view & chat history', () => {
      // Просмотр агента
      const agentRes = http.get(
        `${BASE_URL}/api/v1/study/programs/${programId}/agents/${agentId}`,
        { ...params, tags: { endpoint: 'get_agent' } }
      );
      check(agentRes, {
        'agent get: статус 200': (r) => r.status === 200,
      });

      sleep(0.3);

      // История сообщений (страница 1)
      const msgRes = http.get(
        `${BASE_URL}/api/v1/study/programs/${programId}/agents/${agentId}/messages?page=1&limit=20`,
        { ...params, tags: { endpoint: 'agent_messages' } }
      );
      check(msgRes, {
        'agent messages: статус 200': (r) => r.status === 200,
      });
    });
  }

  sleep(1);
}
