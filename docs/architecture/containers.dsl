workspace "RocketMind" "Архитектура платформы обучения" {

    model {
        student = person "Клиент" "Проходит курсы, общается с AI-агентами"
        admin = person "Администратор" "Управляет программами, уроками, пользователями"
        teacher = person "Преподаватель" "Создаёт и ведёт курсы"

        # Внешние системы
        openai = softwareSystem "OpenAI" "AI-агенты для обучения (Assistants API)" {
            tags "External"
        }
        google = softwareSystem "Google Email" "Отправка писем с кодами авторизации" {
            tags "External"
        }
        s3 = softwareSystem "Yandex Cloud S3" "Хранение файлов: видео, презентации, обложки" {
            tags "External"
        }
        bitrix = softwareSystem "Bitrix" "CRM и бизнес-процессы компании" {
            tags "External"
        }

        rocketmind = softwareSystem "RocketMind" "Платформа онлайн-обучения с AI-агентами" {

            # Фронтенды на Next.js
            saasAdmin = container "saas-admin" "Административный интерфейс SaaS-платформы" "Next.js" {
                tags "Frontend"
            }
            saasTeacher = container "saas-teacher" "Интерфейс преподавателя SaaS-платформы" "Next.js" {
                tags "Frontend"
            }
            rInternal = container "r-internal" "Внутренний портал компании" "Next.js" {
                tags "Frontend"
            }
            rocketmindSaas = container "rocketmind-saas" "Публичный SaaS-сайт платформы" "Next.js" {
                tags "Frontend"
            }
            rocketmindAdminApp = container "rocketmind-admin" "Панель управления продуктом" "Next.js" {
                tags "Frontend"
            }
            rocketmindSite = container "rocketmind-site" "Маркетинговый сайт" "Next.js" {
                tags "Frontend"
            }

            # Бэкенды на Express.js
            accelBack = container "r-accel-back" "Production API сервер" "Node.js / Express.js" {
                tags "Backend"
            }
            rsBackDev = container "rs-back-dev" "Development API сервер" "Node.js / Express.js" {
                tags "Backend"
            }

            # Базы данных
            mongodb = container "MongoDB" "Хранит пользователей, программы, уроки, прогресс, сообщения" "MongoDB" {
                tags "Database"
            }
            postgres = container "PostgreSQL" "Общая БД для Next.js приложений" "PostgreSQL" {
                tags "Database"
            }
        }

        # Связи пользователей
        student -> rocketmindSaas "Изучает курсы"
        student -> saasAdmin "Проходит обучение"
        admin -> rocketmindAdminApp "Управляет платформой"
        admin -> rInternal "Использует внутренний портал"
        teacher -> saasTeacher "Ведёт курсы"

        # Фронтенды → Бэкенды
        saasAdmin -> accelBack "REST API / HTTPS"
        saasTeacher -> accelBack "REST API / HTTPS"
        rocketmindSaas -> accelBack "REST API / HTTPS"

        # Фронтенды → PostgreSQL (SSR / Server Actions)
        rInternal -> postgres "SQL"
        rocketmindAdminApp -> postgres "SQL"
        rocketmindSite -> postgres "SQL"

        # rocketmind-saas также читает из Postgres (SSR)
        rocketmindSaas -> postgres "SQL (SSR)"

        # Бэкенды → MongoDB
        accelBack -> mongodb "Mongoose ODM"
        rsBackDev -> mongodb "Mongoose ODM"

        # Бэкенды → Внешние сервисы
        accelBack -> openai "Assistants API / HTTPS"
        accelBack -> s3 "AWS SDK / HTTPS"
        accelBack -> google "SMTP / Nodemailer"

        rsBackDev -> openai "Assistants API / HTTPS"
        rsBackDev -> s3 "AWS SDK / HTTPS"
        rsBackDev -> google "SMTP / Nodemailer"

        # Next.js → Email
        rocketmindSaas -> google "SMTP / Nodemailer"
        rocketmindAdminApp -> google "SMTP / Nodemailer"

        # Next.js → Bitrix
        rocketmindAdminApp -> bitrix "REST API"
        rocketmindSite -> bitrix "REST API"
    }

    views {
        systemContext rocketmind "Context" "Диаграмма контекста системы" {
            include *
            autoLayout
        }

        container rocketmind "Containers" "Диаграмма контейнеров" {
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
            element "Backend" {
                background #2d6a9f
                color #ffffff
            }
            element "Database" {
                background #438dd5
                color #ffffff
                shape Cylinder
            }
        }
    }
}
