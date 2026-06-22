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
            saasTeacher = container "saas-teacher" "Пользовательский интерфейс онлайн школы" "Next.js" {
                tags "Frontend"
            }

            mongodb = container "MongoDB" "" "MongoDB" {
                tags "Database"
            }

            accelBack = container "r-accel-back" "API сервер" "Node.js / Express.js" {

                # Роуты
                authRoutes = component "Auth Routes" "POST /auth/login, /verify, /refresh, /logout" "Express Router" {
                    tags "Route"
                }
                profileRoutes = component "Profile Routes" "GET /profile, PUT /profile" "Express Router" {
                    tags "Route"
                }
                usersRoutes = component "Users Routes" "GET /users, GET /users/:id, PATCH /users/:id, PUT /users/:id/role" "Express Router" {
                    tags "Route"
                }
                rolesRoutes = component "Roles Routes" "GET /roles, POST /roles, PUT /roles/:id, DELETE /roles/:id" "Express Router" {
                    tags "Route"
                }
                programsRoutes = component "Programs Routes" "CRUD /study/programs + модули и элементы" "Express Router" {
                    tags "Route"
                }
                lessonsRoutes = component "Lessons Routes" "CRUD /study/lessons, /study/lesson-groups" "Express Router" {
                    tags "Route"
                }
                agentsRoutes = component "Agents Routes" "CRUD /study/agents" "Express Router" {
                    tags "Route"
                }
                progressRoutes = component "Progress Routes" "JOIN, прогресс, уроки, агенты, сообщения" "Express Router" {
                    tags "Route"
                }
                filesRoutes = component "Files Routes" "GET /file, POST /file/upload, /multipart/*" "Express Router" {
                    tags "Route"
                }

                # Middleware
                authMiddleware = component "Auth Middleware" "Валидация JWT из cookie, извлечение пользователя" "Middleware" {
                    tags "Middleware"
                }
                permissionMiddleware = component "Permission Middleware" "Проверка прав доступа по роли пользователя" "Middleware" {
                    tags "Middleware"
                }
                validateMiddleware = component "Validate Middleware" "Валидация тела запроса через Zod-схемы" "Middleware" {
                    tags "Middleware"
                }
                checkAccessMiddleware = component "Check Access Middleware" "Проверка доступа к программе, уроку, агенту и разблокировки элемента" "Middleware" {
                    tags "Middleware"
                }

                # Контроллеры
                authController = component "Auth Controller" "Логика логина, верификации кода, рефреша и логаута" "Controller" {
                    tags "Controller"
                }
                profileController = component "Profile Controller" "Получение и обновление профиля" "Controller" {
                    tags "Controller"
                }
                usersController = component "Users Controller" "Список, получение, обновление пользователей и ролей" "Controller" {
                    tags "Controller"
                }
                rolesController = component "Roles Controller" "CRUD ролей и список прав" "Controller" {
                    tags "Controller"
                }
                programsController = component "Programs Controller" "CRUD программ, модулей и элементов, QR-код, join" "Controller" {
                    tags "Controller"
                }
                lessonsController = component "Lessons Controller" "CRUD уроков и групп уроков" "Controller" {
                    tags "Controller"
                }
                agentsController = component "Agents Controller" "CRUD агентов, список OpenAI ассистентов" "Controller" {
                    tags "Controller"
                }
                progressController = component "Progress Controller" "Прогресс, открытие урока, завершение, просмотр агента" "Controller" {
                    tags "Controller"
                }
                messagesController = component "Messages Controller" "История сообщений и отправка сообщения агенту (SSE)" "Controller" {
                    tags "Controller"
                }
                filesController = component "Files Controller" "Список файлов, single upload, multipart upload" "Controller" {
                    tags "Controller"
                }
            }
        }

        # Пользователи → Фронтенды
        admin -> saasAdmin "Использует"
        teacher -> saasTeacher "Использует"

        # Фронтенды → Роуты
        saasAdmin -> authRoutes "HTTP"
        saasAdmin -> profileRoutes "HTTP"
        saasAdmin -> usersRoutes "HTTP"
        saasAdmin -> rolesRoutes "HTTP"
        saasAdmin -> programsRoutes "HTTP"
        saasAdmin -> lessonsRoutes "HTTP"
        saasAdmin -> agentsRoutes "HTTP"
        saasAdmin -> filesRoutes "HTTP"

        saasTeacher -> authRoutes "HTTP"
        saasTeacher -> profileRoutes "HTTP"
        saasTeacher -> programsRoutes "HTTP"
        saasTeacher -> lessonsRoutes "HTTP"
        saasTeacher -> progressRoutes "HTTP"

        # Роуты → Middleware
        authRoutes -> validateMiddleware "Валидирует запрос"
        authRoutes -> authMiddleware "Защищённые маршруты (/logout, /refresh)"

        profileRoutes -> authMiddleware "Проверяет токен"
        profileRoutes -> validateMiddleware "Валидирует запрос"

        usersRoutes -> authMiddleware "Проверяет токен"
        usersRoutes -> permissionMiddleware "users.read / users.update / users_role.update"
        usersRoutes -> validateMiddleware "Валидирует запрос"

        rolesRoutes -> authMiddleware "Проверяет токен"
        rolesRoutes -> permissionMiddleware "roles.read / roles.create / roles.update / roles.delete"
        rolesRoutes -> validateMiddleware "Валидирует запрос"

        programsRoutes -> authMiddleware "Проверяет токен"
        programsRoutes -> permissionMiddleware "study_programs.*"
        programsRoutes -> validateMiddleware "Валидирует запрос"

        lessonsRoutes -> authMiddleware "Проверяет токен"
        lessonsRoutes -> permissionMiddleware "study_lessons.*"
        lessonsRoutes -> validateMiddleware "Валидирует запрос"

        agentsRoutes -> authMiddleware "Проверяет токен"
        agentsRoutes -> permissionMiddleware "study_agents.*"
        agentsRoutes -> validateMiddleware "Валидирует запрос"

        progressRoutes -> authMiddleware "Проверяет токен"
        progressRoutes -> checkAccessMiddleware "Проверяет доступ к программе, уроку, агенту"
        progressRoutes -> validateMiddleware "Валидирует запрос"

        filesRoutes -> authMiddleware "Проверяет токен"
        filesRoutes -> validateMiddleware "Валидирует запрос"

        # Middleware → Контроллеры
        authMiddleware -> authController "req.user"
        authMiddleware -> profileController "req.user"
        authMiddleware -> usersController "req.user"
        authMiddleware -> rolesController "req.user"
        authMiddleware -> programsController "req.user"
        authMiddleware -> lessonsController "req.user"
        authMiddleware -> agentsController "req.user"
        authMiddleware -> progressController "req.user"
        authMiddleware -> messagesController "req.user"
        authMiddleware -> filesController "req.user"

        validateMiddleware -> authController "req.validatedData"
        validateMiddleware -> profileController "req.validatedData"
        validateMiddleware -> usersController "req.validatedData"
        validateMiddleware -> rolesController "req.validatedData"
        validateMiddleware -> programsController "req.validatedData"
        validateMiddleware -> lessonsController "req.validatedData"
        validateMiddleware -> agentsController "req.validatedData"
        validateMiddleware -> progressController "req.validatedData"
        validateMiddleware -> messagesController "req.validatedData"
        validateMiddleware -> filesController "req.validatedData"

        permissionMiddleware -> usersController "Разрешает доступ"
        permissionMiddleware -> rolesController "Разрешает доступ"
        permissionMiddleware -> programsController "Разрешает доступ"
        permissionMiddleware -> lessonsController "Разрешает доступ"
        permissionMiddleware -> agentsController "Разрешает доступ"

        checkAccessMiddleware -> progressController "Разрешает доступ"
        checkAccessMiddleware -> messagesController "Разрешает доступ"

        # Контроллеры → MongoDB
        authController -> mongodb "User: код, токены, lastLogin"
        profileController -> mongodb "User: профиль"
        usersController -> mongodb "User, Role"
        rolesController -> mongodb "Role"
        programsController -> mongodb "StudyProgram"
        lessonsController -> mongodb "StudyLesson, LessonGroup"
        agentsController -> mongodb "StudyAgent"
        progressController -> mongodb "StudyProgress, StudyLesson, StudyAgent"
        messagesController -> mongodb "StudyMessage, User"
        filesController -> mongodb "File"

        # Контроллеры → Внешние сервисы
        authController -> google "Отправляет код авторизации"
        messagesController -> openai "Стримит ответ агента (SSE)"
        filesController -> s3 "Загружает файлы"
        agentsController -> openai "Получает список ассистентов"
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
            element "Database" {
                background #438dd5
                color #ffffff
                shape Cylinder
            }
            element "Route" {
                background #2d6a9f
                color #ffffff
            }
            element "Middleware" {
                background #e67e22
                color #ffffff
            }
            element "Controller" {
                background #27ae60
                color #ffffff
            }
        }
    }
}
