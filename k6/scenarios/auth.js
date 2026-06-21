/**
 * Нагрузочный тест: Auth endpoints
 *
 * Тестирует:
 *   POST /api/v1/auth/login   — отправка кода на email
 *   POST /api/v1/auth/refresh — обновление токена
 *   POST /api/v1/auth/logout  — выход из системы
 *
 * Запуск (smoke):
 *   k6 run -e BASE_URL=https://dev-api-rocketmind-services.ivan-developer.ru \
 *          -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
 *          k6/scenarios/auth.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, loadOptions } from '../config.js';
import { authenticate, authParams } from '../helpers/auth.js';

export const options = {
  ...loadOptions,
  thresholds: {
    'http_req_duration{scenario:login}': ['p(95)<3000'],
    'http_req_duration{scenario:refresh}': ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

const loginErrors = new Counter('login_errors');
const refreshLatency = new Trend('refresh_latency_ms');

export function setup() {
  return { cookies: authenticate() };
}

export default function ({ cookies }) {
  const email = __ENV.TEST_EMAIL || 'loadtest@example.com';

  group('login flow', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email }),
      { headers: { 'Content-Type': 'application/json' }, tags: { scenario: 'login' } }
    );

    const ok = check(res, {
      'login: статус 200': (r) => r.status === 200,
      'login: тело содержит message': (r) => {
        try { return JSON.parse(r.body).message !== undefined; }
        catch { return false; }
      },
    });

    if (!ok) loginErrors.add(1);
  });

  sleep(1);

  if (cookies) {
    group('refresh token', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/v1/auth/refresh`,
        null,
        { headers: { Cookie: `refreshToken=${cookies.refreshToken || ''}` }, tags: { scenario: 'refresh' } }
      );
      refreshLatency.add(Date.now() - start);

      check(res, {
        'refresh: статус 200 или 401': (r) => [200, 401].includes(r.status),
      });
    });

    sleep(0.5);

    group('logout', () => {
      const res = http.post(
        `${BASE_URL}/api/v1/auth/logout`,
        null,
        authParams(cookies)
      );

      check(res, {
        'logout: статус 200': (r) => r.status === 200,
      });
    });
  }

  sleep(1);
}
