/**
 * Главный скрипт нагрузочного тестирования RocketMind Services
 * Все сценарии параллельно — суммарно до 1000 VU.
 *
 * Распределение VU по ролям (реалистичная модель):
 *   student_flow    — 700 VU  (основная аудитория: студенты)
 *   read_heavy      — 150 VU  (просмотр контента без прогресса)
 *   write_moderate  —  80 VU  (администраторы, CRUD)
 *   files_flow      —  50 VU  (загрузка файлов)
 *   programs_flow   —  20 VU  (управление программами)
 *
 * Переменные окружения:
 *   K6_AUTH_COOKIES  — куки "accessToken=...;refreshToken=..."
 *   QR_CODE          — QR-код программы (для student_flow)
 *   PROGRAM_ID       — ID программы (если уже вступили)
 *   LESSON_ID        — ID урока
 *   TEST_EMAIL       — email тестового пользователя
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=..." \
 *          -e QR_CODE="<qr>" \
 *          k6/main.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL } from './config.js';
import { authenticate, authParams } from './helpers/auth.js';

// ─── Профили нагрузки ─────────────────────────────────────────────────────────
// Все сценарии стартуют одновременно и плавно поднимаются до пика.
// Фазы: разогрев (1м) → пик (3м) → остывание (1м)

const ramp = (target) => [
  { duration: '1m',  target: Math.round(target * 0.5) },  // разогрев до 50%
  { duration: '3m',  target },                             // пик
  { duration: '1m',  target: 0 },                         // остывание
];

export const options = {
  scenarios: {

    // 700 VU — студенты: вступление, прогресс, уроки
    student_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ramp(700),
      gracefulRampDown: '30s',
      exec: 'studentScenario',
    },

    // 150 VU — чтение контента (список программ, уроков, файлов, профиль)
    read_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ramp(150),
      gracefulRampDown: '30s',
      exec: 'readScenario',
    },

    // 80 VU — администраторы: CRUD программ, уроков, ролей, профиля
    write_moderate: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ramp(80),
      gracefulRampDown: '30s',
      exec: 'writeScenario',
    },

    // 50 VU — загрузка файлов
    files_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ramp(50),
      gracefulRampDown: '30s',
      exec: 'filesScenario',
    },

    // 20 VU — управление учебными программами (тяжёлые CRUD)
    programs_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ramp(20),
      gracefulRampDown: '30s',
      exec: 'programsScenario',
    },
  },

  thresholds: {
    // Глобальные пороги
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
    http_req_failed:   ['rate<0.05'],

    // Пороги по сценариям
    'http_req_duration{scenario:student_flow}':   ['p(95)<3000'],
    'http_req_duration{scenario:read_heavy}':     ['p(95)<2000'],
    'http_req_duration{scenario:write_moderate}': ['p(95)<5000'],
    'http_req_duration{scenario:files_flow}':     ['p(95)<8000'],
    'http_req_duration{scenario:programs_flow}':  ['p(95)<5000'],
  },
};

// ─── Setup (однократно перед стартом) ────────────────────────────────────────

export function setup() {
  const cookies = authenticate();
  if (!cookies) {
    console.warn('Аутентификация не удалась — все сценарии будут пропущены');
  }
  return {
    cookies:   cookies || {},
    qrCode:    __ENV.QR_CODE     || null,
    programId: __ENV.PROGRAM_ID  || null,
    lessonId:  __ENV.LESSON_ID   || null,
    agentId:   __ENV.AGENT_ID    || null,
  };
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function guard(cookies) {
  if (!cookies || !cookies.accessToken) { sleep(1); return false; }
  return true;
}

function tryJson(body) {
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

function safeBody(res) {
  return (res && res.body) ? tryJson(res.body) : {};
}

// ─── Сценарий 1: Студент ─────────────────────────────────────────────────────

export function studentScenario(data) {
  const { cookies, qrCode } = data;
  if (!guard(cookies)) return;

  const params = authParams(cookies);
  let programId = data.programId;
  let lessonId  = data.lessonId;

  // 1. Вступить в программу (или получить 409 если уже вступил — ок)
  if (qrCode) {
    const res = http.post(
      `${BASE_URL}/api/v1/study/programs/join`,
      JSON.stringify({ qrCode }),
      { ...params, tags: { endpoint: 'join' } }
    );
    check(res, { 'join: 200 или 409': (r) => [200, 409].includes(r.status) });

    if (!programId) {
      programId = safeBody(res).data?.programId;
    }
  }

  if (!programId) { sleep(1); return; }

  sleep(0.5);

  // 2. Прогресс программы
  const progressRes = http.get(
    `${BASE_URL}/api/v1/study/programs/${programId}/progress`,
    { ...params, tags: { endpoint: 'progress' } }
  );
  check(progressRes, { 'progress: 200': (r) => r.status === 200 });

  // Найти первый доступный урок если не передан
  if (!lessonId && progressRes.status === 200) {
    const modules = safeBody(progressRes).data?.modules || [];
    for (const mod of modules) {
      for (const item of mod.items || []) {
        if (item.accessible && item.type === 'StudyLesson') {
          lessonId = item.item?._id || item.item;
          break;
        }
      }
      if (lessonId) break;
    }
  }

  sleep(1);

  // 3. Открыть урок
  if (lessonId) {
    const lessonRes = http.get(
      `${BASE_URL}/api/v1/study/programs/${programId}/lessons/${lessonId}`,
      { ...params, tags: { endpoint: 'open_lesson' } }
    );
    check(lessonRes, { 'lesson open: 200': (r) => r.status === 200 });

    sleep(2); // студент читает урок

    // 4. Завершить урок
    const completeRes = http.post(
      `${BASE_URL}/api/v1/study/programs/${programId}/lessons/${lessonId}/complete`,
      null,
      { ...params, tags: { endpoint: 'complete_lesson' } }
    );
    check(completeRes, { 'lesson complete: 200 или 409': (r) => [200, 409].includes(r.status) });
  }

  sleep(1);
}

// ─── Сценарий 2: Чтение контента ─────────────────────────────────────────────

export function readScenario(data) {
  const { cookies } = data;
  if (!guard(cookies)) return;

  const params = authParams(cookies);

  group('read: profile', () => {
    const res = http.get(`${BASE_URL}/api/v1/profile`, { ...params, tags: { endpoint: 'profile' } });
    check(res, { 'GET profile: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: programs', () => {
    const res = http.get(`${BASE_URL}/api/v1/study/programs`, { ...params, tags: { endpoint: 'programs' } });
    check(res, { 'GET programs: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: lessons', () => {
    const res = http.get(`${BASE_URL}/api/v1/study/lessons`, { ...params, tags: { endpoint: 'lessons' } });
    check(res, { 'GET lessons: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: roles', () => {
    const res = http.get(`${BASE_URL}/api/v1/roles`, { ...params, tags: { endpoint: 'roles' } });
    check(res, { 'GET roles: 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('read: users', () => {
    const res = http.get(`${BASE_URL}/api/v1/users?page=1&limit=10`, { ...params, tags: { endpoint: 'users' } });
    check(res, { 'GET users: 200': (r) => r.status === 200 });
  });

  sleep(1);
}

// ─── Сценарий 3: Администратор (CRUD) ────────────────────────────────────────

export function writeScenario(data) {
  const { cookies } = data;
  if (!guard(cookies)) return;

  const params = authParams(cookies);

  // Обновить профиль
  group('write: profile', () => {
    http.put(
      `${BASE_URL}/api/v1/profile`,
      JSON.stringify({ profession: `k6-admin-${__VU}` }),
      { ...params, tags: { endpoint: 'put_profile' } }
    );
  });

  sleep(1);

  // CRUD урока
  group('write: lesson CRUD', () => {
    const name = `k6-lesson-${__VU}-${Date.now()}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/study/lessons`,
      JSON.stringify({
        name,
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'k6 test' }] }] },
      }),
      { ...params, tags: { endpoint: 'create_lesson' } }
    );
    check(createRes, { 'POST lesson: 201': (r) => r.status === 201 });

    const id = safeBody(createRes)._id;
    if (id) {
      sleep(0.3);
      http.del(`${BASE_URL}/api/v1/study/lessons/${id}`, null, { ...params, tags: { endpoint: 'delete_lesson' } });
    }
  });

  sleep(1);

  // CRUD роли
  group('write: role CRUD', () => {
    const name = `k6-role-${__VU}-${Date.now()}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/roles`,
      JSON.stringify({ name, permissions: ['users.read'] }),
      { ...params, tags: { endpoint: 'create_role' } }
    );
    check(createRes, { 'POST role: 201': (r) => r.status === 201 });

    const id = safeBody(createRes)._id;
    if (id) {
      sleep(0.3);
      http.del(`${BASE_URL}/api/v1/roles/${id}`, null, { ...params, tags: { endpoint: 'delete_role' } });
    }
  });

  sleep(1);
}

// ─── Сценарий 4: Загрузка файлов ─────────────────────────────────────────────

export function filesScenario(data) {
  const { cookies } = data;
  if (!guard(cookies)) return;

  const params = authParams(cookies);

  // Список файлов
  group('files: list', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/file?page=1&limit=10`,
      { ...params, tags: { endpoint: 'list_files' } }
    );
    check(res, { 'GET files: 200': (r) => r.status === 200 });
  });

  sleep(1);

  // Загрузка файла (1×1 PNG)
  group('files: upload', () => {
    const png = new Uint8Array([
      0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
      0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
      0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
      0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,
      0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
      0x00,0x00,0x02,0x00,0x01,0xe2,0x21,0xbc,
      0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
      0x44,0xae,0x42,0x60,0x82,
    ]).buffer;

    const res = http.post(
      `${BASE_URL}/api/v1/file/upload`,
      { file: http.file(png, `k6-vu${__VU}-${Date.now()}.png`, 'image/png') },
      { headers: { Cookie: params.headers.Cookie }, tags: { endpoint: 'upload_file' } }
    );
    check(res, { 'POST upload: 200 или 201': (r) => [200, 201].includes(r.status) });
  });

  sleep(1);
}

// ─── Сценарий 5: Управление программами ──────────────────────────────────────

export function programsScenario(data) {
  const { cookies } = data;
  if (!guard(cookies)) return;

  const params = authParams(cookies);

  // Список программ
  const listRes = http.get(
    `${BASE_URL}/api/v1/study/programs`,
    { ...params, tags: { endpoint: 'list_programs' } }
  );
  check(listRes, { 'GET programs: 200': (r) => r.status === 200 });

  sleep(0.5);

  // Создать → обновить → добавить модуль → удалить программу
  group('programs: lifecycle', () => {
    const name = `k6-prog-${__VU}-${Date.now()}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/study/programs`,
      JSON.stringify({ name, sequential: true, active: false }),
      { ...params, tags: { endpoint: 'create_program' } }
    );
    check(createRes, { 'POST program: 201': (r) => r.status === 201 });

    const progId = safeBody(createRes)._id;
    if (!progId) return;

    sleep(0.3);

    http.patch(
      `${BASE_URL}/api/v1/study/programs/${progId}`,
      JSON.stringify({ description: 'k6 update' }),
      { ...params, tags: { endpoint: 'patch_program' } }
    );

    sleep(0.3);

    const modRes = http.post(
      `${BASE_URL}/api/v1/study/programs/${progId}/modules`,
      JSON.stringify({ name: 'Модуль k6' }),
      { ...params, tags: { endpoint: 'create_module' } }
    );

    const modules = safeBody(modRes).modules || [];
    const modId = modules[modules.length - 1]?._id;

    if (modId) {
      sleep(0.3);
      http.del(
        `${BASE_URL}/api/v1/study/programs/${progId}/modules/${modId}`,
        null,
        { ...params, tags: { endpoint: 'delete_module' } }
      );
    }

    sleep(0.3);

    http.del(
      `${BASE_URL}/api/v1/study/programs/${progId}`,
      null,
      { ...params, tags: { endpoint: 'delete_program' } }
    );
  });

  sleep(1);
}
