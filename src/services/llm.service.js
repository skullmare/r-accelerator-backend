import openai from '../../config/openai.config.js';

// messages: [{ role: 'system'|'user'|'assistant', content }]
// Single non-streaming call — used where the full response is needed before
// anything happens next (artifact generation parses the whole JSON reply).
export async function chatComplete({ model, temperature, maxTokens, messages }) {
    const result = await openai.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages
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
