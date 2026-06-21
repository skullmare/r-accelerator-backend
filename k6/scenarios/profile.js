/**
 * Нагрузочный тест: Profile endpoints
 *
 * Тестирует:
 *   GET /api/v1/profile  — получение профиля
 *   PUT /api/v1/profile  — обновление профиля
 *
 * Запуск:
 *   k6 run -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          k6/scenarios/profile.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{endpoint:get_profile}': ['p(95)<500'],
    'http_req_duration{endpoint:put_profile}': ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

const getProfileLatency = new Trend('get_profile_latency_ms');
const putProfileLatency = new Trend('put_profile_latency_ms');

export function setup() {
  const cookies = authenticate();
  if (!cookies) throw new Error('Аутентификация не удалась');
  return { cookies };
}

export default function ({ cookies }) {
  const params = authParams(cookies);

  group('GET /profile', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/v1/profile`,
      { ...params, tags: { endpoint: 'get_profile' } }
    );
    getProfileLatency.add(Date.now() - start);

    check(res, {
      'profile GET: статус 200': (r) => r.status === 200,
      'profile GET: есть поле email': (r) => {
        try { return !!JSON.parse(r.body).email; }
        catch { return false; }
      },
    });
  });

  sleep(0.5);

  group('PUT /profile', () => {
    const body = JSON.stringify({
      firstName: 'Load',
      lastName: 'Tester',
      profession: 'QA Engineer',
      fieldOfActivity: 'Testing',
      city: 'Test City',
    });

    const start = Date.now();
    const res = http.put(
      `${BASE_URL}/api/v1/profile`,
      body,
      { ...params, tags: { endpoint: 'put_profile' } }
    );
    putProfileLatency.add(Date.now() - start);

    check(res, {
      'profile PUT: статус 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
