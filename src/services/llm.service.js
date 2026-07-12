import openai from '../../config/openai.config.js';

// messages: [{ role: 'system'|'user'|'assistant', content }]
export async function chatComplete({ provider, model, temperature, maxTokens, messages }) {
    if (provider === 'openrouter') {
        // Loaded lazily: @openrouter/sdk is ESM-only with no CJS build, so
        // importing it eagerly would force every test file that touches the
        // routing layer to pay for transforming its whole dependency tree,
        // even when no agent actually uses this provider.
        const { default: openrouter } = await import('../../config/openrouter.config.js');
        const result = await openrouter.chat.send({
            chatRequest: { messages, model, temperature, maxTokens, stream: false }
        });

        return {
            content: result.choices?.[0]?.message?.content ?? '',
            tokenUsage: result.usage ?? null
        };
    }

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
