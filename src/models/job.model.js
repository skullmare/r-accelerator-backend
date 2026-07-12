import mongoose from 'mongoose';

// Generic durable job queue backed by MongoDB. Claiming a job is a single
// atomic findOneAndUpdate, so multiple server replicas can poll the same
// collection without double-processing a job.
const JobSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    payload: {
        // Mongoose doesn't reliably track/persist Schema.Types.Mixed when the
        // value is `{}` (it isn't flagged as modified), so this deliberately
        // isn't `required` — an empty payload is a perfectly valid job.
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 5
    },
    runAt: {
        type: Date,
        default: Date.now
    },
    lockedAt: {
        type: Date,
        default: null
    },
    lastError: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

JobSchema.index({ status: 1, type: 1, runAt: 1 });

const Job = mongoose.model('Job', JobSchema);
export default Job;
