/**
 * @swagger
 * components:
 *   schemas:
 *     ModuleItem:
 *       type: object
 *       description: >
 *         Элемент модуля программы (урок или агент) в "сыром" виде — item как
 *         ObjectId-строка, без populate. В этом виде возвращается всеми эндпоинтами
 *         редактирования модулей/программы. Единственное исключение —
 *         GET /study/programs/{programId} (см. схему StudyProgram), которое делает
 *         populate('modules.items.item') и отдаёт item как полный документ.
 *       properties:
 *         _id:
 *           type: string
 *           description: >
 *             Идентификатор элемента внутри модуля (subdocument _id) — используется
 *             в путях DELETE .../items/{itemId} и в теле reorder-запросов.
 *         type:
 *           type: string
 *           enum: [StudyLesson, StudyAgent]
 *           description: >
 *             Тип элемента — определяет, в какую коллекцию ссылается item (refPath:
 *             'type' в ModuleItemSchema). Используется и при Mongoose populate
 *             (get-program.controller.js), и вручную веткой if/else при сборке
 *             прогресса (get-progress.controller.js).
 *         item:
 *           type: string
 *           description: ID урока (StudyLesson) или агента (StudyAgent) — конкретная коллекция определяется полем type.
 *     StudyModule:
 *       type: object
 *       description: Модуль программы обучения со списком уроков/агентов в порядке прохождения.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор модуля.
 *         name:
 *           type: string
 *           description: Название модуля программы.
 *         items:
 *           type: array
 *           description: >
 *             Уроки/агенты внутри модуля, в порядке прохождения — этот порядок
 *             используется check-item-unlocked.middleware.js для определения
 *             "предыдущего элемента", который должен быть пройден при sequential=true.
 *           items:
 *             $ref: '#/components/schemas/ModuleItem'
 *     StudyProgram:
 *       type: object
 *       description: >
 *         Полная программа обучения с популированными модулями — этот вид отдаёт
 *         только GET /study/programs/{programId} (get-program.controller.js делает
 *         .populate('modules.items.item') без выбора полей, поэтому item — это
 *         полный документ StudyLesson или StudyAgent, а не ID-строка).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор программы.
 *         name:
 *           type: string
 *           description: Название программы обучения.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Описание программы для каталога.
 *         coverMeta:
 *           type: object
 *           nullable: true
 *           additionalProperties: true
 *           description: >
 *             Технические метаданные обложки из S3 (например, размер/тип) —
 *             произвольная структура, задаётся на загрузке обложки.
 *         cover:
 *           type: string
 *           nullable: true
 *           description: URL обложки программы для каталога.
 *         sequential:
 *           type: boolean
 *           description: >
 *             Если true — элементы программы открываются строго по порядку
 *             (check-item-unlocked.middleware.js блокирует доступ, пока не пройден
 *             предыдущий элемент по StudyProgress.completedItems). Если false —
 *             доступ ко всем элементам открыт сразу.
 *         active:
 *           type: boolean
 *           description: >
 *             Активна ли программа. join-program.controller.js ищет программу по
 *             qrCode только среди active:true — по неактивной программе
 *             присоединиться нельзя.
 *         qrCode:
 *           type: string
 *           description: >
 *             Уникальный код (по факту — SHA-256-хэш, несмотря на имя "QR") для
 *             присоединения к программе через POST /study/programs/join. Это ключ
 *             приглашения, а не хранимое изображение QR-кода.
 *         modules:
 *           type: array
 *           description: Модули программы с популированными элементами (item — полный документ, не ID).
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Идентификатор модуля.
 *               name:
 *                 type: string
 *                 description: Название модуля программы.
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Идентификатор элемента внутри модуля.
 *                     type:
 *                       type: string
 *                       enum: [StudyLesson, StudyAgent]
 *                       description: Тип элемента — определяет, какая из схем ниже используется в item.
 *                     item:
 *                       description: >
 *                         Полный документ урока или агента (populate без выбора
 *                         полей) — конкретный тип определяется соседним полем type.
 *                       oneOf:
 *                         - $ref: '#/components/schemas/StudyLesson'
 *                         - $ref: '#/components/schemas/StudyAgent'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания программы.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения программы.
 */
