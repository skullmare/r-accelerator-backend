/**
 * Нагрузочный тест: Study Programs endpoints
 *
 * Требует: права study_programs.read, study_programs.create,
 *          study_programs.update, study_programs.delete
 *
 * Тестирует полный CRUD программы + управление модулями и элементами:
 *   GET    /api/v1/study/programs
 *   POST   /api/v1/study/programs
 *   GET    /api/v1/study/programs/:id
 *   PATCH  /api/v1/study/programs/:id
 *   DELETE /api/v1/study/programs/:id
 *   POST   /api/v1/study/programs/:id/modules
 *   PATCH  /api/v1/study/programs/:id/modules/:moduleId
 *   DELETE /api/v1/study/programs/:id/modules/:moduleId
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          k6/scenarios/study-programs.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{endpoint:list_programs}': ['p(95)<800'],
    'http_req_duration{endpoint:get_program}': ['p(95)<800'],
    'http_req_duration{endpoint:create_program}': ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const listLatency = new Trend('programs_list_latency_ms');

export function setup() {
  const cookies = authenticate();
  if (!cookies) throw new Error('Аутентификация не удалась');
  return { cookies };
}

export default function ({ cookies }) {
  const params = authParams(cookies);
  let programId = null;
  let moduleId = null;

  group('Programs — list', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/v1/study/programs`,
      { ...params, tags: { endpoint: 'list_programs' } }
    );
    listLatency.add(Date.now() - start);

    check(res, {
      'programs list: статус 200': (r) => r.status === 200,
      'programs list: массив': (r) => {
        try { return Array.isArray(JSON.parse(r.body)); }
        catch { return false; }
      },
    });

    // Берём первый ID для GET by ID
    try {
      const list = JSON.parse(res.body);
      if (list.length > 0) programId = list[0]._id;
    } catch {}
  });

  sleep(0.3);

  if (programId) {
    group('Programs — get by ID', () => {
      const res = http.get(
        `${BASE_URL}/api/v1/study/programs/${programId}`,
        { ...params, tags: { endpoint: 'get_program' } }
      );
      check(res, {
        'program get: статус 200': (r) => r.status === 200,
        'program get: есть modules': (r) => {
          try { return Array.isArray(JSON.parse(r.body).modules); }
          catch { return false; }
        },
      });

      // Берём первый модуль
      try {
        const prog = JSON.parse(res.body);
        if (prog.modules && prog.modules.length > 0) moduleId = prog.modules[0]._id;
      } catch {}
    });
    sleep(0.3);
  }

  group('Programs — full CRUD lifecycle', () => {
    // Создание программы
    const name = `k6-program-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/study/programs`,
      JSON.stringify({
        name,
        description: 'Тестовая программа от k6',
        sequential: true,
        active: false,
      }),
      { ...params, tags: { endpoint: 'create_program' } }
    );

    check(createRes, {
      'program create: статус 201': (r) => r.status === 201,
    });

    let newProgramId = null;
    try { newProgramId = JSON.parse(createRes.body)._id; } catch {}

    if (!newProgramId) {
      sleep(1);
      return;
    }

    sleep(0.3);

    // Обновление программы
    const patchRes = http.patch(
      `${BASE_URL}/api/v1/study/programs/${newProgramId}`,
      JSON.stringify({ description: 'Обновлено k6' }),
      { ...params, tags: { endpoint: 'patch_program' } }
    );
    check(patchRes, {
      'program patch: статус 200': (r) => r.status === 200,
    });

    sleep(0.3);

    // Добавление модуля
    const modRes = http.post(
      `${BASE_URL}/api/v1/study/programs/${newProgramId}/modules`,
      JSON.stringify({ name: 'Модуль k6' }),
      { ...params, tags: { endpoint: 'create_module' } }
    );
    check(modRes, {
      'module create: статус 200 или 201': (r) => [200, 201].includes(r.status),
    });

    let newModuleId = null;
    try {
      const prog = JSON.parse(modRes.body);
      const mods = prog.modules || [];
      if (mods.length > 0) newModuleId = mods[mods.length - 1]._id;
    } catch {}

    sleep(0.3);

    if (newModuleId) {
      // Переименование модуля
      const renameRes = http.patch(
        `${BASE_URL}/api/v1/study/programs/${newProgramId}/modules/${newModuleId}`,
        JSON.stringify({ name: 'Переименованный модуль' }),
        { ...params, tags: { endpoint: 'patch_module' } }
      );
      check(renameRes, {
        'module rename: статус 200': (r) => r.status === 200,
      });

      sleep(0.3);

      // Удаление модуля
      http.del(
        `${BASE_URL}/api/v1/study/programs/${newProgramId}/modules/${newModuleId}`,
        null,
        { ...params, tags: { endpoint: 'delete_module' } }
      );
    }

    sleep(0.3);

    // Удаление программы
    const deleteRes = http.del(
      `${BASE_URL}/api/v1/study/programs/${newProgramId}`,
      null,
      { ...params, tags: { endpoint: 'delete_program' } }
    );
    check(deleteRes, {
      'program delete: статус 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
