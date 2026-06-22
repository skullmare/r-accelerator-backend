workspace "RocketMind" "Диаграмма развёртывания" {

    model {
        student = person "Клиент"
        admin   = person "Администратор"

        rocketmind = softwareSystem "RocketMind" {
            saasAdmin      = container "saas-admin"      "Административный фронт (Next.js)"  "Next.js"
            saasTeacher    = container "saas-teacher"    "Интерфейс преподавателя (Next.js)" "Next.js"
            rocketmindSaas = container "rocketmind-saas" "Клиентский фронт (Next.js)"       "Next.js"
            backDev        = container "rs-back-dev"     "API (dev-окружение)"               "Node.js / Express"
            backProd       = container "r-accel-back"    "API (prod-окружение)"              "Node.js / Express"
            mongoDev       = container "mongodb-dev"     "База данных (dev)"                 "MongoDB"
            mongoProd      = container "mongodb-prod"    "База данных (prod)"                "MongoDB"
        }

        openai = softwareSystem "OpenAI"           "AI-агенты для обучения (Assistants API)"       "External"
        google = softwareSystem "Google Email"     "Отправка писем с кодами авторизации"           "External"
        s3     = softwareSystem "Yandex Cloud S3"  "Хранение файлов: видео, презентации, обложки"  "External"

        // ── Production ────────────────────────────────────────────────────────
        prod = deploymentEnvironment "Production" {

            amveraProd = deploymentNode "Amvera PaaS" "Платформа контейнерного хостинга" "PaaS" {

                deploymentNode "saas-admin" "Административный фронт" "Node.js container" {
                    containerInstance saasAdmin
                }
                deploymentNode "saas-teacher" "Фронт преподавателя" "Node.js container" {
                    containerInstance saasTeacher
                }
                deploymentNode "rocketmind-saas" "Клиентский фронт" "Node.js container" {
                    containerInstance rocketmindSaas
                }
                deploymentNode "r-accel-back" "Backend API" "Node.js container" {
                    containerInstance backProd
                }
                deploymentNode "mongodb-prod" "База данных" "MongoDB container" {
                    containerInstance mongoProd
                }
            }

            deploymentNode "OpenAI Cloud" "Внешний сервис" "SaaS" {
                softwareSystemInstance openai
            }
            deploymentNode "Google Cloud" "Внешний сервис" "SaaS" {
                softwareSystemInstance google
            }
            deploymentNode "Yandex Cloud" "Внешний сервис" "Cloud" {
                softwareSystemInstance s3
            }
        }

        // ── Development ───────────────────────────────────────────────────────
        dev = deploymentEnvironment "Development" {

            amveraDev = deploymentNode "Amvera PaaS" "Платформа контейнерного хостинга" "PaaS" {

                deploymentNode "rs-back-dev" "Backend API (dev)" "Node.js container" {
                    containerInstance backDev
                }
                deploymentNode "mongodb-dev" "База данных (dev)" "MongoDB container" {
                    containerInstance mongoDev
                }
            }

            deploymentNode "OpenAI Cloud" "Внешний сервис" "SaaS" {
                softwareSystemInstance openai
            }
            deploymentNode "Google Cloud" "Внешний сервис" "SaaS" {
                softwareSystemInstance google
            }
            deploymentNode "Yandex Cloud" "Внешний сервис" "Cloud" {
                softwareSystemInstance s3
            }
        }

        // Связи пользователей
        admin   -> saasAdmin      "Управление"   "HTTPS"
        admin   -> saasTeacher    "Контент"      "HTTPS"
        student -> rocketmindSaas "Обучение"     "HTTPS"

        saasAdmin      -> backProd "API-запросы"  "HTTPS / REST"
        saasTeacher    -> backProd "API-запросы"  "HTTPS / REST"
        rocketmindSaas -> backProd "API-запросы"  "HTTPS / REST + SSE"

        backProd -> mongoProd "Чтение/запись" "TCP 27017"
        backDev  -> mongoDev  "Чтение/запись" "TCP 27017"

        backProd -> openai "Assistants API"  "HTTPS"
        backDev  -> openai "Assistants API"  "HTTPS"
        backProd -> google "SMTP / Gmail API" "HTTPS"
        backDev  -> google "SMTP / Gmail API" "HTTPS"
        backProd -> s3     "S3 API"           "HTTPS"
        backDev  -> s3     "S3 API"           "HTTPS"
    }

    views {

        deployment rocketmind "Production" "Deployment-Prod" {
            include *
            autoLayout
        }

        deployment rocketmind "Development" "Deployment-Dev" {
            include *
            autoLayout
        }

        styles {
            element "Person" {
                shape Person
                background #1168bd
                color #ffffff
            }
            element "Container" {
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
            element "Infrastructure Node" {
                background #ffffff
            }
        }
    }
}
