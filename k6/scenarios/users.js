/**
 * Нагрузочный тест: Users & Roles endpoints (Admin)
 *
 * Требует: пользователь с правами users.read, roles.read, roles.create, roles.update, roles.delete
 *
 * Тестирует:
 *   GET  /api/v1/users              — список пользователей с пагинацией
 *   GET  /api/v1/users/:id          — пользователь по ID
 *   GET  /api/v1/roles              — список ролей
 *   GET  /api/v1/roles/permissions  — список прав
 *   POST /api/v1/roles              — создание роли
 *   PUT  /api/v1/roles/:id          — обновление роли
 *   DELETE /api/v1/roles/:id        — удаление роли
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          k6/scenarios/users.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{endpoint:list_users}': ['p(95)<1000'],
    'http_req_duration{endpoint:list_roles}': ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const cookies = authenticate();
  if (!cookies) throw new Error('Аутентификация не удалась');
  return { cookies };
}

export default function ({ cookies }) {
  const params = authParams(cookies);
  let firstUserId = null;
  let createdRoleId = null;

  group('Users — list & get', () => {
    // Список пользователей (страница 1, 10 на странице)
    const listRes = http.get(
      `${BASE_URL}/api/v1/users?page=1&limit=10`,
      { ...params, tags: { endpoint: 'list_users' } }
    );

    check(listRes, {
      'users list: статус 200': (r) => r.status === 200,
      'users list: есть массив data': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); }
        catch { return false; }
      },
    });

    // Сохраняем первый ID для дальнейших запросов
    try {
      const data = JSON.parse(listRes.body).data;
      if (data && data.length > 0) firstUserId = data[0]._id;
    } catch {}

    sleep(0.3);

    // Список с фильтром по email
    const emailFilter = __ENV.TEST_EMAIL || '';
    if (emailFilter) {
      const filteredRes = http.get(
        `${BASE_URL}/api/v1/users?email=${encodeURIComponent(emailFilter)}`,
        { ...params, tags: { endpoint: 'list_users' } }
      );
      check(filteredRes, {
        'users filter by email: статус 200': (r) => r.status === 200,
      });
    }
  });

  sleep(0.5);

  if (firstUserId) {
    group('Users — get by ID', () => {
      const res = http.get(
        `${BASE_URL}/api/v1/users/${firstUserId}`,
        { ...params, tags: { endpoint: 'get_user' } }
      );
      check(res, {
        'user get: статус 200': (r) => r.status === 200,
        'user get: есть _id': (r) => {
          try { return !!JSON.parse(r.body)._id; }
          catch { return false; }
        },
      });
    });
    sleep(0.3);
  }

  group('Roles — CRUD', () => {
    // Список прав
    const permsRes = http.get(
      `${BASE_URL}/api/v1/roles/permissions`,
      { ...params, tags: { endpoint: 'list_permissions' } }
    );
    check(permsRes, {
      'permissions: статус 200': (r) => r.status === 200,
    });

    sleep(0.3);

    // Список ролей
    const listRes = http.get(
      `${BASE_URL}/api/v1/roles`,
      { ...params, tags: { endpoint: 'list_roles' } }
    );
    check(listRes, {
      'roles list: статус 200': (r) => r.status === 200,
    });

    sleep(0.3);

    // Создание роли
    const roleName = `k6-role-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createRes = http.post(
      `${BASE_URL}/api/v1/roles`,
      JSON.stringify({ name: roleName, permissions: ['users.read'] }),
      { ...params, tags: { endpoint: 'create_role' } }
    );
    check(createRes, {
      'role create: статус 201': (r) => r.status === 201,
    });

    try {
      createdRoleId = JSON.parse(createRes.body)._id;
    } catch {}

    sleep(0.3);

    // Обновление роли
    if (createdRoleId) {
      const updateRes = http.put(
        `${BASE_URL}/api/v1/roles/${createdRoleId}`,
        JSON.stringify({ name: roleName + '-updated', permissions: ['users.read', 'roles.read'] }),
        { ...params, tags: { endpoint: 'update_role' } }
      );
      check(updateRes, {
        'role update: статус 200': (r) => r.status === 200,
      });

      sleep(0.3);

      // Удаление роли (очистка)
      const deleteRes = http.del(
        `${BASE_URL}/api/v1/roles/${createdRoleId}`,
        null,
        { ...params, tags: { endpoint: 'delete_role' } }
      );
      check(deleteRes, {
        'role delete: статус 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1);
}
