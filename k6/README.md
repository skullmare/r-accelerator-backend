# k6 Load Tests — RocketMind Services

Нагрузочные тесты для `https://dev-api-rocketmind-services.ivan-developer.ru`.

## Структура

```
k6/
├── config.js                  # Общие настройки, пороги, профили нагрузки
├── helpers/
│   └── auth.js                # Хелпер аутентификации (куки JWT)
├── scenarios/
│   ├── auth.js                # Auth endpoints (login, refresh, logout)
│   ├── profile.js             # GET/PUT /profile
│   ├── users.js               # Users + Roles CRUD (admin)
│   ├── study-programs.js      # Study Programs CRUD + модули
│   ├── study-lessons.js       # Study Lessons + Lesson Groups CRUD
│   ├── study-progress.js      # Студенческий flow (join, progress, complete)
│   └── files.js               # File upload (single + multipart init/abort)
└── main.js                    # Мастер-скрипт: все сценарии параллельно
```

## Установка k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Аутентификация

Backend использует HttpOnly cookie JWT. Для тестов нужно получить куки вручную:

1. Вызвать `POST /api/v1/auth/login` с вашим email → получите код на почту
2. Вызвать `POST /api/v1/auth/verify` с email + кодом
3. Скопировать куки `accessToken` и `refreshToken` из ответа

```bash
# Шаг 1 — запросить код
curl -c cookies.txt -X POST https://dev-api-rocketmind-services.ivan-developer.ru/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"your@email.com"}'

# Шаг 2 — ввести код из письма
curl -c cookies.txt -X POST https://dev-api-rocketmind-services.ivan-developer.ru/api/v1/auth/verify \
  -H "Content-Type: application/json" -d '{"email":"your@email.com","code":"123456"}'

# Смотрим полученные куки
cat cookies.txt
```

Затем передаём куки в k6:
```bash
export K6_AUTH_COOKIES="accessToken=eyJ...;refreshToken=eyJ..."
```

## Запуск

### Все сценарии (параллельно)
```bash
k6 run \
  -e K6_AUTH_COOKIES="accessToken=...;refreshToken=..." \
  -e TEST_EMAIL=your@email.com \
  -e PROGRAM_ID=<id> \
  -e LESSON_ID=<id> \
  k6/main.js
```

### Отдельные сценарии

```bash
# Auth
k6 run -e TEST_EMAIL=your@email.com k6/scenarios/auth.js

# Profile
k6 run -e K6_AUTH_COOKIES="..." k6/scenarios/profile.js

# Пользователи и роли (нужны admin-права)
k6 run -e K6_AUTH_COOKIES="..." k6/scenarios/users.js

# Study Programs
k6 run -e K6_AUTH_COOKIES="..." k6/scenarios/study-programs.js

# Study Lessons
k6 run -e K6_AUTH_COOKIES="..." k6/scenarios/study-lessons.js

# Студенческий flow (нужен QR-код или PROGRAM_ID)
k6 run \
  -e K6_AUTH_COOKIES="..." \
  -e QR_CODE="<qr>" \
  -e PROGRAM_ID="<id>" \
  -e LESSON_ID="<id>" \
  k6/scenarios/study-progress.js

# Files
k6 run -e K6_AUTH_COOKIES="..." k6/scenarios/files.js
```

### Профили нагрузки

Профиль задаётся через переменную `SCENARIO_TYPE` или переопределением опций:

| Профиль | VUs | Длительность | Назначение |
|---------|-----|-------------|-----------|
| smoke   | 1   | 30s         | Базовая проверка работоспособности |
| load    | 10  | 2m          | Нормальная нагрузка |
| stress  | 100 | 3m          | Нагрузка выше нормы |
| spike   | 200 | 1m 30s      | Резкий пик |
| soak    | 10  | 30m+        | Проверка утечек памяти |

Переключение профиля (пример для stress):
```bash
k6 run --stage "30s:20,1m:50,30s:100,1m:100,30s:0" \
  -e K6_AUTH_COOKIES="..." k6/scenarios/profile.js
```

## Просмотр результатов

### Встроенный вывод
k6 выводит статистику в терминал по завершению теста.

### Grafana + InfluxDB (рекомендуется)
```bash
# Запустить InfluxDB + Grafana через Docker
docker-compose up -d influxdb grafana

# Запустить тест с отправкой метрик
k6 run --out influxdb=http://localhost:8086/k6 \
  -e K6_AUTH_COOKIES="..." k6/main.js
```

### Grafana Cloud k6
```bash
k6 run --out cloud k6/main.js
```

## Переменные окружения

| Переменная        | Обязательна | Описание |
|-------------------|-------------|---------|
| `BASE_URL`        | Нет         | URL сервера (по умолчанию dev) |
| `K6_AUTH_COOKIES` | Да*         | Куки в формате `accessToken=...;refreshToken=...` |
| `TEST_EMAIL`      | Для auth    | Email тестового пользователя |
| `TEST_AUTH_CODE`  | Для auth    | 6-значный код из письма |
| `QR_CODE`         | Для join    | QR-код программы |
| `PROGRAM_ID`      | Рекомендуется | ID программы для студенческого flow |
| `LESSON_ID`       | Опционально | ID урока |
| `AGENT_ID`        | Опционально | ID агента |

*Если не указаны `K6_AUTH_COOKIES`, нужны `TEST_EMAIL` + `TEST_AUTH_CODE`

## Пороги (SLO)

| Метрика | Порог |
|---------|-------|
| p(95) latency | < 3000ms |
| p(99) latency | < 8000ms |
| Error rate    | < 5% |
| Read endpoints p(95) | < 1000ms |
| Write endpoints p(95) | < 2000ms |
