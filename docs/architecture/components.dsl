workspace "RocketMind — Компоненты r-accel-back" {

    model {
        admin = person "Администратор"
        teacher = person "Преподаватель"

        openai = softwareSystem "OpenAI" "Assistants API" {
            tags "External"
        }
        google = softwareSystem "Google Email" "SMTP" {
            tags "External"
        }
        s3 = softwareSystem "Yandex Cloud S3" "Хранение файлов" {
            tags "External"
        }

        rocketmind = softwareSystem "RocketMind" {

            saasAdmin = container "saas-admin" "Административный интерфейс" "Next.js" {
                tags "Frontend"
            }
            saasTeacher = container "saas-teacher" "Интерфейс преподавателя" "Next.js" {
                tags "Frontend"
            }

            mongodb = container "MongoDB" "" "MongoDB" {
                tags "Database"
            }

            accelBack = container "r-accel-back" "API сервер" "Node.js / Express.js" {

                authModule = component "Auth Module" "Аутентификация по email-коду, выдача JWT-токенов" "Express Router"
                profileModule = component "Profile Module" "Просмотр и редактирование профиля текущего пользователя" "Express Router"
                usersModule = component "Users Module" "Управление пользователями, назначение ролей" "Express Router"
                rolesModule = component "Roles Module" "CRUD ролей и прав доступа" "Express Router"
                programsModule = component "Study Programs Module" "Управление учебными программами и модулями" "Express Router"
                lessonsModule = component "Study Lessons Module" "Управление уроками и группами уроков" "Express Router"
                agentsModule = component "Study Agents Module" "Управление AI-агентами" "Express Router"
                progressModule = component "Study Progress Module" "Прогресс студента, завершение уроков, чат с агентом" "Express Router"
                filesModule = component "Files Module" "Загрузка файлов: single upload и multipart" "Express Router"

                emailService = component "Email Service" "Отправка кодов авторизации на email" "Nodemailer"
                openaiService = component "OpenAI Service" "Стриминг ответов AI-агента (SSE)" "OpenAI SDK"
                s3Service = component "S3 Service" "Загрузка файлов в объектное хранилище" "AWS SDK"

                authMiddleware = component "Auth Middleware" "Валидация JWT из cookie, извлечение пользователя" "Middleware"
                permissionMiddleware = component "Permission Middleware" "Проверка прав доступа по роли" "Middleware"
            }
        }

        # Пользователи → Фронтенды
        admin -> saasAdmin "Использует"
        teacher -> saasTeacher "Использует"

        # Фронтенды → Бэкенд
        saasAdmin -> accelBack "REST API / HTTPS"
        saasTeacher -> accelBack "REST API / HTTPS"

        # Фронтенды → Компоненты
        saasAdmin -> authModule "POST /auth/login, /verify, /refresh, /logout"
        saasAdmin -> profileModule "GET, PUT /profile"
        saasAdmin -> usersModule "GET, PATCH /users"
        saasAdmin -> rolesModule "CRUD /roles"
        saasAdmin -> programsModule "CRUD /study/programs"
        saasAdmin -> lessonsModule "CRUD /study/lessons, /lesson-groups"
        saasAdmin -> agentsModule "CRUD /study/agents"
        saasAdmin -> filesModule "POST /file/upload, /multipart"

        saasTeacher -> authModule "POST /auth/login, /verify, /refresh, /logout"
        saasTeacher -> profileModule "GET, PUT /profile"
        saasTeacher -> programsModule "GET /study/programs"
        saasTeacher -> lessonsModule "GET /study/lessons"
        saasTeacher -> progressModule "GET /study/programs/:id/progress"

        # Внутренние связи компонентов
        authModule -> authMiddleware "Использует для защищённых маршрутов"
        authModule -> emailService "Отправляет код авторизации"
        profileModule -> authMiddleware "Проверяет токен"
        usersModule -> authMiddleware "Проверяет токен"
        usersModule -> permissionMiddleware "Проверяет права users.read / users.update"
        rolesModule -> authMiddleware "Проверяет токен"
        rolesModule -> permissionMiddleware "Проверяет права roles.*"
        programsModule -> authMiddleware "Проверяет токен"
        programsModule -> permissionMiddleware "Проверяет права study_programs.*"
        lessonsModule -> authMiddleware "Проверяет токен"
        lessonsModule -> permissionMiddleware "Проверяет права study_lessons.*"
        agentsModule -> authMiddleware "Проверяет токен"
        agentsModule -> permissionMiddleware "Проверяет права study_agents.*"
        progressModule -> authMiddleware "Проверяет токен"
        progressModule -> openaiService "Отправляет сообщение агенту, стримит ответ"
        filesModule -> authMiddleware "Проверяет токен"
        filesModule -> s3Service "Загружает файлы"

        # Компоненты → MongoDB
        authModule -> mongodb "Читает/пишет пользователей"
        profileModule -> mongodb "Читает/пишет профиль"
        usersModule -> mongodb "Читает/пишет пользователей и роли"
        rolesModule -> mongodb "Читает/пишет роли"
        programsModule -> mongodb "Читает/пишет программы"
        lessonsModule -> mongodb "Читает/пишет уроки"
        agentsModule -> mongodb "Читает/пишет агентов"
        progressModule -> mongodb "Читает/пишет прогресс и сообщения"
        filesModule -> mongodb "Сохраняет метаданные файлов"

        # Сервисы → Внешние системы
        emailService -> google "SMTP"
        openaiService -> openai "Assistants API / HTTPS"
        s3Service -> s3 "AWS SDK / HTTPS"
    }

    views {
        component accelBack "Components" "Компоненты r-accel-back" {
            include *
            autoLayout
        }

        styles {
            element "Person" {
                shape Person
                background #1168bd
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Frontend" {
                background #438dd5
                color #ffffff
                shape WebBrowser
            }
            element "Container" {
                background #2d6a9f
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Database" {
                background #438dd5
                color #ffffff
                shape Cylinder
            }
        }
    }
}
