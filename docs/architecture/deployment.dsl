workspace "RocketMind" "Диаграмма развёртывания" {

    model {
        student = person "Клиент"
        admin   = person "Администратор"

        rocketmind = softwareSystem "RocketMind" {
            saasAdmin      = container "saas-admin"      "Административный фронт"  "Next.js"
            saasTeacher    = container "saas-teacher"    "Фронт преподавателя"     "Next.js"
            rocketmindSaas = container "rocketmind-saas" "Клиентский фронт"        "Next.js"
            backDev        = container "rs-back-dev"     "API (dev)"               "Node.js / Express"
            backProd       = container "r-accel-back"    "API (prod)"              "Node.js / Express"
            mongoDev       = container "mongodb-dev"     "База данных (dev)"       "MongoDB"
            mongoProd      = container "mongodb-prod"    "База данных (prod)"      "MongoDB"
        }

        openai = softwareSystem "OpenAI"          "Assistants API"         "External"
        google = softwareSystem "Google Email"    "SMTP / Gmail API"       "External"
        s3     = softwareSystem "Yandex Cloud S3" "Хранение файлов"        "External"

        // ── Production ────────────────────────────────────────────────
        prod = deploymentEnvironment "Production" {

            deploymentNode "Amvera PaaS" "Контейнерный хостинг" "PaaS" {
                tags "Amvera"

                deploymentNode "saas-admin" "" "Node.js container" {
                    containerInstance saasAdmin
                }
                deploymentNode "saas-teacher" "" "Node.js container" {
                    containerInstance saasTeacher
                }
                deploymentNode "rocketmind-saas" "" "Node.js container" {
                    containerInstance rocketmindSaas
                }
                deploymentNode "r-accel-back" "" "Node.js container" {
                    containerInstance backProd
                }
                deploymentNode "mongodb-prod" "" "MongoDB container" {
                    containerInstance mongoProd
                }
            }
        }

        // ── Development ───────────────────────────────────────────────
        dev = deploymentEnvironment "Development" {

            deploymentNode "Amvera PaaS" "Контейнерный хостинг" "PaaS" {
                tags "Amvera"

                deploymentNode "rs-back-dev" "" "Node.js container" {
                    containerInstance backDev
                }
                deploymentNode "mongodb-dev" "" "MongoDB container" {
                    containerInstance mongoDev
                }
            }
        }

        // Связи
        admin   -> saasAdmin      "Управляет"   "HTTPS"
        admin   -> saasTeacher    "Управляет"   "HTTPS"
        student -> rocketmindSaas "Обучается"   "HTTPS"

        saasAdmin      -> backProd "REST API"        "HTTPS"
        saasTeacher    -> backProd "REST API"        "HTTPS"
        rocketmindSaas -> backProd "REST API + SSE"  "HTTPS"

        backProd -> mongoProd "read/write" "TCP 27017"
        backDev  -> mongoDev  "read/write" "TCP 27017"

        backProd -> openai "Assistants API"  "HTTPS"
        backDev  -> openai "Assistants API"  "HTTPS"
        backProd -> google "Gmail API"       "HTTPS"
        backDev  -> google "Gmail API"       "HTTPS"
        backProd -> s3     "S3 API"          "HTTPS"
        backDev  -> s3     "S3 API"          "HTTPS"
    }

    views {

        deployment rocketmind "Production" "Deployment-Prod" {
            include *
            autoLayout lr
        }

        deployment rocketmind "Development" "Deployment-Dev" {
            include *
            autoLayout lr
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
                shape RoundedBox
            }
            element "Software System" {
                background #1168bd
                color #ffffff
                shape RoundedBox
            }
            element "External" {
                background #999999
                color #ffffff
                shape RoundedBox
            }
            element "Infrastructure Node" {
                background #ffffff
                color #000000
                shape RoundedBox
            }
            element "Amvera" {
                background #e8f4e8
                color #000000
                stroke #2d7d2d
            }
        }
    }
}
