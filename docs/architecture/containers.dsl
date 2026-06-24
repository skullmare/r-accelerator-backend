workspace "RocketMind" "Архитектура платформы обучения" {

    model {
        client = person "Клиент" "Проходит курсы, общается с AI-агентами"
        admin = person "Администратор" "Управляет программами, уроками, пользователями"

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
        rocketmind = softwareSystem "RocketMind" "Платформа онлайн-обучения с AI-агентами" {

            saasAdmin = container "saas-admin" "Административный интерфейс платформы" "Next.js" {
                tags "Frontend"
            }
            saasTeacher = container "saas-teacher" "Интерфейс онлайн школы" "Next.js" {
                tags "Frontend"
            }
            rocketmindSaas = container "rocketmind-saas" "Интерфейс Р-Акселератор" "Next.js" {
                tags "Frontend"
            }

            accelBack = container "r-accel-back" "API сервер" "Node.js / Express.js" {
                tags "Backend"
            }

            mongodb = container "MongoDB" "Хранит пользователей, программы, уроки, прогресс, сообщения" "MongoDB" {
                tags "Database"
            }
        }

        # Связи пользователей
        client -> rocketmindSaas "Использует агентов"
        admin -> saasAdmin "Управляет платформой"
        client -> saasTeacher "Проходит курсы и агентов"

        # Фронтенды → Бэкенд
        saasAdmin -> accelBack "REST API / HTTPS"
        saasTeacher -> accelBack "REST API / HTTPS"
        rocketmindSaas -> accelBack "REST API / HTTPS"

        # Бэкенд → БД
        accelBack -> mongodb "Mongoose ODM"

        # Бэкенд → Внешние сервисы
        accelBack -> openai "Assistants API / HTTPS"
        accelBack -> s3 "AWS SDK / HTTPS"
        accelBack -> google "SMTP / Nodemailer"

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
