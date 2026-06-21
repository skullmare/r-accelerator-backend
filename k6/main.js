/**
 * Главный скрипт нагрузочного тестирования RocketMind Services
 *
 * Запускает все сценарии параллельно с разными профилями нагрузки.
 * Каждый сценарий имеет свой executor и VU-пул.
 *
 * Переменные окружения:
 *   BASE_URL         — адрес сервера (по умолчанию dev-окружение)
 *   K6_AUTH_COOKIES  — куки вида "accessToken=...;refreshToken=..."
 *   TEST_EMAIL       — email для теста /auth/login
 *   QR_CODE          — QR-код программы для студенческого сценария
 *   PROGRAM_ID       — ID программы (если уже вступили)
 *   LESSON_ID        — ID урока
 *   AGENT_ID         — ID агента
 *
 * Запуск полного теста:
 *   k6 run -e BASE_URL=https://dev-api-rocketmind-services.ivan-developer.ru \
 *          -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          -e TEST_EMAIL=test@example.com \
 *          k6/main.js
 *
 * Только определённый сценарий:
 *   k6 run --scenario profile k6/main.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL } from './config.js';
import { authenticate, authParams } from './helpers/auth.js';

export const options = {
  scenarios: {
    // Профиль чтения — частые read-only запросы (имитирует активных пользователей)
    read_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'readScenario',
    },

    // Профиль записи — CRUD операции (имитирует администраторов)
    write_moderate: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '2m', target: 5 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'writeScenario',
    },

    // Студенческий поток — просмотр прогресса
    student_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 15 },
        { duration: '2m', target: 15 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'studentScenario',
    },

    // Auth нагрузка — умеренный темп, чтобы не триггерить rate limiting
    // Запускай отдельно: k6 run k6/scenarios/auth.js
    // auth_flow отключён в основном прогоне намеренно.
  },

  thresholds: {
    // Глобальные пороги
    http_req_duration: ['p(95)<3000', 'p(99)<8000'],
    http_req_failed: ['rate<0.05'],

    // Пороги по сценариям
    'http_req_duration{scenario:read_heavy}': ['p(95)<1000'],
    'http_req_duration{scenario:write_moderate}': ['p(95)<2000'],
    'http_req_duration{scenario:student_flow}': ['p(95)<1500'],
  },
};

// ─── Shared setup ────────────────────────────────────────────────────────────

export function setup() {
  const cookies = authenticate();
  if (!cookies) {
    console.warn('Аутентификация не удалась — некоторые сценарии будут пропущены');
  }
  return {
    cookies: cookies || {},
    programId: __ENV.PROGRAM_ID || null,
    lessonId: __ENV.LESSON_ID || null,
    agentId: __ENV.AGENT_ID || null,
    qrCode: __ENV.QR_CODE || null,
  };
}

// ─── Сценарий чтения (GET запросы) ───────────────────────────────────────────

export function readScenario(data) {
  const { cookies } = data;
  if (!cookies.accessToken) { sleep(1); return; }

  const params = authParams(cookies);

  group('read: profile', () => {
    const res = http.get(`${BASE_URL}/api/v1/profile`, params);
    check(res, { 'GET profile: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: programs list', () => {
    const res = http.get(`${BASE_URL}/api/v1/study/programs`, params);
    check(res, { 'GET programs: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: lessons list', () => {
    const res = http.get(`${BASE_URL}/api/v1/study/lessons`, params);
    check(res, { 'GET lessons: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: files list', () => {
    const res = http.get(`${BASE_URL}/api/v1/file?page=1&limit=10`, params);
    check(res, { 'GET files: 200': (r) => r.status === 200 });
  });

  sleep(1);
}

// ─── Сценарий записи (CRUD) ───────────────────────────────────────────────────

export function writeScenario(data) {
  const { cookies } = data;
  if (!cookies.accessToken) { sleep(1); return; }

  const params = authParams(cookies);

  group('write: update profile', () => {
    const res = http.put(
      `${BASE_URL}/api/v1/profile`,
      JSON.stringify({ profession: `k6-tester-${Date.now()}` }),
      params
    );
    check(res, { 'PUT profile: 200': (r) => r.status === 200 });
  });

  sleep(1);

  group('write: role CRUD', () => {
    const name = `k6-role-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const createRes = http.post(
      `${BASE_URL}/api/v1/roles`,
      JSON.stringify({ name, permissions: ['users.read'] }),
      params
    );
    check(createRes, { 'POST role: 201': (r) => r.status === 201 });

    let id = null;
    try { id = JSON.parse(createRes.body)._id; } catch {}

    if (id) {
      sleep(0.3);
      http.del(`${BASE_URL}/api/v1/roles/${id}`, null, params);
    }
  });

  sleep(1);
}

// ─── Студенческий сценарий ────────────────────────────────────────────────────

export function studentScenario(data) {
  const { cookies, programId, lessonId, agentId } = data;
  if (!cookies.accessToken || !programId) { sleep(1); return; }

  const params = authParams(cookies);

  group('student: view progress', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/study/programs/${programId}/progress`,
      params
    );
    check(res, { 'GET progress: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  if (lessonId) {
    group('student: open lesson', () => {
      const res = http.get(
        `${BASE_URL}/api/v1/study/programs/${programId}/lessons/${lessonId}`,
        params
      );
      check(res, { 'GET lesson: 200': (r) => r.status === 200 });
    });
    sleep(0.5);
  }

  if (agentId) {
    group('student: agent messages', () => {
      const res = http.get(
        `${BASE_URL}/api/v1/study/programs/${programId}/agents/${agentId}/messages?page=1&limit=20`,
        params
      );
      check(res, { 'GET agent messages: 200': (r) => r.status === 200 });
    });
  }

  sleep(1);
}

// ─── Auth сценарий ────────────────────────────────────────────────────────────

export function authScenario() {
  const email = __ENV.TEST_EMAIL || 'loadtest@example.com';

  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'POST login: 200': (r) => r.status === 200,
    'POST login: latency < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
