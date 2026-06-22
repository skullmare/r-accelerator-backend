// Base configuration shared across all k6 scripts
export const BASE_URL = __ENV.BASE_URL || 'https://dev-api-rocketmind-services.ivan-developer.ru';

// Default thresholds for all scenarios
export const defaultThresholds = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.05'],
};

// Smoke test — минимальная нагрузка для базовой проверки
export const smokeOptions = {
  vus: 1,
  duration: '30s',
  thresholds: defaultThresholds,
};

// Load test — нормальная нагрузка
export const loadOptions = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: defaultThresholds,
};

// Stress test — нагрузка выше нормы
export const stressOptions = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

// Spike test — резкий пик
export const spikeOptions = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '10s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '10s', target: 5 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    http_req_failed: ['rate<0.15'],
  },
};

// Soak test — длительная нагрузка для проверки утечек памяти
export const soakOptions = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '30m', target: 10 },
    { duration: '2m', target: 0 },
  ],
  thresholds: defaultThresholds,
};
