/**
 * @swagger
 * components:
 *   schemas:
 *     StudyLessonMeta:
 *       type: object
 *       description: >
 *         Мета-данные урока без content — то, что возвращает GET /study/lessons
 *         (list-lessons.controller.js делает StudyLesson.find с проекцией
 *         'name cover group video presentation createdAt' и populate('group', 'name')).
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор урока.
 *         name:
 *           type: string
 *           description: Название урока, отображается в списках/модулях программы.
 *         cover:
 *           type: string
 *           nullable: true
 *           format: uri
 *           description: URL фото-обложки урока.
 *         group:
 *           type: object
 *           nullable: true
 *           description: >
 *             Группа урока, популированная через .populate('group', 'name') — содержит
 *             только _id и name. В отличие от полного объекта LessonGroup (GET
 *             /study/lesson-groups) здесь нет createdAt/updatedAt, так как populate
 *             выбирает только поле name.
 *           properties:
 *             _id:
 *               type: string
 *               description: Идентификатор группы.
 *             name:
 *               type: string
 *               description: Название группы.
 *         video:
 *           type: object
 *           nullable: true
 *           description: Ссылка на видео урока.
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *               description: URL видео урока.
 *         presentation:
 *           type: object
 *           nullable: true
 *           description: Ссылка на презентацию урока.
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *               description: URL презентации урока.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания урока.
 *     StudyLesson:
 *       type: object
 *       description: >
 *         Полный урок с контентом. Возвращается admin CRUD-эндпоинтами (POST/GET/PATCH
 *         /study/lessons/{lessonId}) без populate, а также прогресс-эндпоинтом
 *         GET /study/programs/{programId}/lessons/{lessonId} — get-lesson.controller.js
 *         из домена progress, несмотря на расположение и имя функции getProgressLesson,
 *         делает обычный StudyLesson.findById(lessonId) без populate и без обрезки полей,
 *         т.е. отдаёт точно такой же документ.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор урока.
 *         name:
 *           type: string
 *           description: Название урока, отображается в списках/модулях программы.
 *         cover:
 *           type: string
 *           nullable: true
 *           format: uri
 *           description: URL фото-обложки урока.
 *         group:
 *           type: string
 *           nullable: true
 *           description: >
 *             ID группы урока (LessonGroup). В этих эндпоинтах populate не делается —
 *             поле отдаётся как обычная ObjectId-строка (в отличие от StudyLessonMeta,
 *             где group — populated-объект).
 *         video:
 *           type: object
 *           nullable: true
 *           description: Ссылка на видео урока.
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *               description: URL видео урока.
 *         presentation:
 *           type: object
 *           nullable: true
 *           description: Ссылка на презентацию урока.
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *               description: URL презентации урока.
 *         content:
 *           type: object
 *           description: >
 *             Контент урока в формате TipTap/ProseMirror JSON. Хранится и отдаётся как
 *             есть — сервер не парсит и не трансформирует его, рендер/редактирование
 *             целиком на стороне клиента.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания урока.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения урока (timestamps:true в модели).
 */
