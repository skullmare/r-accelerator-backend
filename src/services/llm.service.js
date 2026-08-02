import openai from '../../config/openai.config.js';

// messages: [{ role: 'system'|'user'|'assistant', content }]
// Single non-streaming call — used where the full response is needed before
// anything happens next (writing the stage document).
//
// `json: true` switches the provider into structured-output mode
// (response_format: json_object), which makes the model physically unable to
// emit prose or markdown fences around the answer. Any caller that parses the
// reply as JSON must pass it — asking for JSON in the prompt text alone is a
// request, not a guarantee.
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
//
// `tools` / `toolChoice` пробрасываются в провайдера как есть. Возвращаемый
// toolCalls — уже собранный из дельт список вызовов: в стриме имя функции и
// её аргументы приходят по кускам (arguments — построчно склеиваемая строка
// JSON), поэтому чанки аккумулируются по tc.index, а не по id: id приходит
// только в первом чанке вызова, в последующих его нет.
//
// toolChoice: 'none' — единственный способ ГАРАНТИРОВАТЬ, что модель не
// вызовет инструмент на этом проходе (в отличие от просьбы в промпте). На нём
// держится потолок числа раундов в expert-session.service.js.
export async function chatCompleteStream({ model, temperature, maxTokens, messages, onDelta, tools, toolChoice }) {
    const stream = await openai.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(tools?.length ? { tools } : {}),
        ...(tools?.length && toolChoice ? { tool_choice: toolChoice } : {})
    });

    let content = '';
    let tokenUsage = null;
    const toolCallsByIndex = new Map();

    for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;

        if (delta?.content) {
            content += delta.content;
            onDelta?.(delta.content);
        }

        for (const call of delta?.tool_calls ?? []) {
            const acc = toolCallsByIndex.get(call.index)
                ?? { id: '', type: 'function', function: { name: '', arguments: '' } };

            if (call.id) acc.id = call.id;
            if (call.function?.name) acc.function.name = call.function.name;
            if (call.function?.arguments) acc.function.arguments += call.function.arguments;

            toolCallsByIndex.set(call.index, acc);
        }

        if (chunk.usage) {
            tokenUsage = chunk.usage;
        }
    }

    return { content, tokenUsage, toolCalls: [...toolCallsByIndex.values()] };
}
