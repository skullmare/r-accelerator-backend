import mongoose from 'mongoose';

// Generic, admin-defined AI agent. `code` is a free-form string chosen by
// whoever creates the agent (e.g. "R1", "onboarding-coach") — this schema
// makes no assumption about a fixed R1..R5 route. Ordering and routing
// between agents is entirely data-driven via `order` and `nextAgentCode`.
const AgentSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 50
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    roleTitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    order: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    systemPrompt: {
        type: String,
        required: true,
        maxlength: 20000
    },
    completionCriteria: {
        type: String,
        required: true,
        maxlength: 5000
    },
    artifactDefinition: {
        artifactType: { type: String, required: true, trim: true, maxlength: 100 },
        titleTemplate: { type: String, trim: true, default: null, maxlength: 200 },
        requiredFields: { type: [String], default: [] },
        outputSchema: { type: mongoose.Schema.Types.Mixed, default: null },
        summaryField: { type: String, trim: true, default: 'summary', maxlength: 100 }
    },
    nextAgentCode: {
        type: String,
        trim: true,
        default: null
    },
    contextPolicy: {
        includeProjectSummary: { type: Boolean, default: true },
        includePreviousArtifacts: { type: Boolean, default: true },
        qdrantTopK: { type: Number, default: 6, min: 1, max: 20 },
        maxContextChars: { type: Number, default: 6000, min: 500, max: 40000 },
        allowedSourceTypes: {
            type: [String],
            default: ['project_summary', 'artifact', 'file_chunk']
        }
    },
    modelConfig: {
        provider: { type: String, enum: ['openai', 'openrouter'], default: 'openai' },
        model: { type: String, trim: true, default: 'gpt-4o-mini' },
        temperature: { type: Number, default: 0.4, min: 0, max: 2 },
        maxTokens: { type: Number, default: 1500, min: 100, max: 8000 }
    }
}, {
    timestamps: true
});

AgentSchema.index({ order: 1 });

const Agent = mongoose.model('Agent', AgentSchema);
export default Agent;
