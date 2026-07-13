import mongoose from 'mongoose';

// Generic durable job queue backed by MongoDB. Claiming a job is a single
// atomic findOneAndUpdate, so multiple server replicas can poll the same
// collection without double-processing a job.
const JobSchema = new mongoose.Schema({
    // Тип задачи — строка-маршрут, по которой воркер выбирает обработчик
    // (registerHandler(type, handler) в worker.js). Сейчас в системе
    // зарегистрирован один тип — 'file:process' (обработка файла).
    type: {
        type: String,
        required: true
    },
    payload: {
        // Mongoose doesn't reliably track/persist Schema.Types.Mixed when the
        // value is `{}` (it isn't flagged as modified), so this deliberately
        // isn't `required` — an empty payload is a perfectly valid job.
        // Произвольные данные задачи — например { fileId } для
        // 'file:process'. Обработчик сам знает, что ожидать по типу задачи.
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // pending — ждёт воркера; processing — взята в работу (claimNextJob
    // атомарно переводит сюда); completed — успешно выполнена, больше не
    // трогается; failed — попытки исчерпаны (attempts >= maxAttempts).
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    // Сколько раз задачу уже пытались выполнить — увеличивается на 1 при
    // каждом claimNextJob, независимо от результата.
    attempts: {
        type: Number,
        default: 0
    },
    // Потолок попыток. При attempts >= maxAttempts задача помечается
    // failed окончательно, воркер её больше не заберёт.
    maxAttempts: {
        type: Number,
        default: 5
    },
    // Время, не раньше которого задачу можно забрать. Используется и для
    // немедленного старта (runAt = сейчас при enqueue), и для отложенного
    // повторного запуска после ошибки (failJob сдвигает runAt вперёд с
    // экспоненциальной задержкой).
    runAt: {
        type: Date,
        default: Date.now
    },
    // Момент, когда задачу забрал воркер — служебное поле для
    // диагностики зависших задач (не используется в логике claim/retry
    // напрямую, только выставляется).
    lockedAt: {
        type: Date,
        default: null
    },
    // Текст последней ошибки (обрезанный до 2000 символов) — чтобы понять,
    // почему задача упала, без похода в логи сервера.
    lastError: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Под этот индекс заточен единственный запрос воркера — claimNextJob
// ищет { status: 'pending', type: {$in: [...]}, runAt: {$lte: now} }.
JobSchema.index({ status: 1, type: 1, runAt: 1 });

const Job = mongoose.model('Job', JobSchema);
export default Job;
