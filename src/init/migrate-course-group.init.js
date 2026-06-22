import User from '../models/user.model.js';
import logger from '../../config/logger.config.js';

/**
 * Миграция: переносит значение из поля `courseGroup` в массив `studyPrograms`.
 *
 * Было:  { courseGroup: ObjectId(...) }
 * Стало: { studyPrograms: [ObjectId(...)] }
 *
 * Запускается идемпотентно при старте сервера — если поле `courseGroup`
 * больше ни у кого не существует, ничего не делает.
 */
export async function migrateCourseGroupToStudyPrograms() {
    const count = await User.countDocuments({ courseGroup: { $exists: true } });

    if (count === 0) {
        logger.info('Миграция courseGroup → studyPrograms: ничего не нужно мигрировать');
        return;
    }

    const result = await User.updateMany(
        { courseGroup: { $exists: true, $ne: null } },
        [
            { $set: { studyPrograms: ['$courseGroup'] } },
            { $unset: 'courseGroup' },
        ]
    );

    // Чистим оставшиеся документы с courseGroup: null (если такие есть)
    await User.updateMany(
        { courseGroup: { $exists: true } },
        { $unset: { courseGroup: '' } }
    );

    logger.info(
        `Миграция courseGroup → studyPrograms: обновлено ${result.modifiedCount} из ${count} пользователей`
    );
}
