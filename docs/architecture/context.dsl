workspace "RocketMind" "Архитектура платформы обучения" {

    model {
        student = person "Клиент" "Проходит курсы, общается с AI-агентами"
        admin = person "Администратор" "Управляет программами, уроками, пользователями"

        rocketmind = softwareSystem "RocketMind" "Платформа онлайн-обучения с AI-агентами"

        openai = softwareSystem "OpenAI" "AI-агенты для обучения (Assistants API)" {
            tags "External"
        }
        google = softwareSystem "Google Email" "Отправка писем с кодами авторизации" {
            tags "External"
        }
        s3 = softwareSystem "Yandex Cloud S3" "Хранение файлов: видео, презентации, обложки" {
            tags "External"
        }

        student -> rocketmind "Проходит уроки, общается с AI-агентами"
        admin -> rocketmind "Создаёт контент, управляет пользователями"
        rocketmind -> openai "Отправляет сообщения, получает ответы (SSE)"
        rocketmind -> google "Отправляет коды авторизации на email"
        rocketmind -> s3 "Загружает и раздаёт файлы"

    }

    views {
        systemContext rocketmind "Context" "Диаграмма контекста системы" {
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
        }
    }
}
