import openai from '../../config/openai.config.js';

// messages: [{ role: 'system'|'user'|'assistant', content }]
// Single non-streaming call — used where the full response is needed before
// anything happens next (artifact generation parses the whole JSON reply).
//
// `json: true` switches the provider into structured-output mode
// (response_format: json_object), which makes the model physically unable to
// emit prose or markdown fences around the answer. Callers that parse the
// reply as JSON (artifact fields, completion evaluation) must pass it —
// asking for JSON in the prompt text alone is a request, not a guarantee.
export async function chatComplete({ model, temperature, maxTokens, messages, json = false }) {
    const result = await openai.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
        ...(json ? { response_format: { type: 'json_object' } } : {})
    });

    return {
        content: result.choices?.[0]?.message?.content ?? '',
        tokenUsage: result.usage ?? null
    };
}

// Same call, streamed — used for chat turns delivered to the user over SSE.
// onDelta is invoked with each text fragment as it arrives; the full
// accumulated text (and usage, if the API returned it) is returned once the
// stream ends, so callers can persist the complete message afterwards.
export async function chatCompleteStream({ model, temperature, maxTokens, messages, onDelta }) {
    const stream = await openai.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
        stream: true,
        stream_options: { include_usage: true }
    });

    let content = '';
    let tokenUsage = null;

    for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
            content += delta;
            onDelta?.(delta);
        }
        if (chunk.usage) {
            tokenUsage = chunk.usage;
        }
    }

    return { content, tokenUsage };
}
