import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config.js';

/**
 * Получает куки сессии через email-код.
 *
 * Так как backend отправляет код на email, для автоматизации
 * нужно передать уже известный код (из окружения) или использовать
 * заранее полученный токен через переменную K6_AUTH_COOKIES.
 *
 * Переменные окружения:
 *   TEST_EMAIL       — email тестового пользователя
 *   TEST_AUTH_CODE   — 6-значный код (если уже известен)
 *   K6_AUTH_COOKIES  — готовые куки вида "accessToken=...; refreshToken=..."
 */
export function authenticate() {
  // Если переданы готовые куки — используем их напрямую
  if (__ENV.K6_AUTH_COOKIES) {
    return parseCookies(__ENV.K6_AUTH_COOKIES);
  }

  const email = __ENV.TEST_EMAIL;
  const code = __ENV.TEST_AUTH_CODE;

  if (!email || !code) {
    console.error(
      'Укажите TEST_EMAIL и TEST_AUTH_CODE, либо K6_AUTH_COOKIES.\n' +
      'Пример: k6 run -e TEST_EMAIL=test@example.com -e TEST_AUTH_CODE=123456 script.js'
    );
    return null;
  }

  // Шаг 1: запросить код (в реальном тесте код уже должен быть на почте)
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'auth/login: статус 200': (r) => r.status === 200,
  });

  // Шаг 2: верифицировать код
  const verifyRes = http.post(
    `${BASE_URL}/api/v1/auth/verify`,
    JSON.stringify({ email, code }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const ok = check(verifyRes, {
    'auth/verify: статус 200': (r) => r.status === 200,
  });

  if (!ok) {
    console.error(`auth/verify failed: ${verifyRes.status} ${verifyRes.body}`);
    return null;
  }

  // Извлекаем куки из ответа
  const cookies = extractCookies(verifyRes);
  if (!cookies.accessToken) {
    console.error('accessToken не найден в куках ответа');
    return null;
  }

  return cookies;
}

// Формирует строку Cookie-заголовка из объекта кук
export function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// Возвращает объект params с Cookie и Content-Type заголовками
export function authParams(cookies, extra = {}) {
  return {
    headers: {
      Cookie: cookieHeader(cookies),
      'Content-Type': 'application/json',
      ...extra,
    },
  };
}

function extractCookies(response) {
  const cookies = {};
  const jar = response.cookies;
  for (const [name, entries] of Object.entries(jar || {})) {
    if (entries && entries.length > 0) {
      cookies[name] = entries[0].value;
    }
  }
  return cookies;
}

function parseCookies(str) {
  const cookies = {};
  str.split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  });
  return cookies;
}
