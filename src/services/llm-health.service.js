// Диагностика LLM-провайдеров: живы ли они, валидны ли ключи, есть ли деньги.
//
// Смысл в том, чтобы отличать причины друг от друга. Снаружи «агент не
// отвечает» выглядит одинаково, а внутри это четыре разные ситуации с четырьмя
// разными действиями: сеть не пускает (чинить инфраструктуру), ключ битый
// (перевыпустить), деньги кончились (пополнить), размерность эмбеддингов
// разъехалась с коллекцией Qdrant (переиндексировать). Без такой проверки
// каждая из них диагностируется вручную по логам.
//
// Провайдера два и падают они независимо: чат агентов ходит в прямой OpenAI
// (config/openai.config.js), эмбеддинги — в OpenRouter
// (config/openrouter.config.js). Умерший OpenRouter не трогает study, но
// полностью останавливает акселератор: сборка контекста начинается с
// векторного поиска.

import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai';
import openai from '../../config/openai.config.js';
import openrouter from '../../config/openrouter.config.js';
import { EMBEDDING_MODEL, EMBEDDING_DIM } from '../../config/embedding.config.js';

// Каждая проверка — реальный сетевой вызов, поэтому таймаут короткий: эндпоинт
// диагностики должен отвечать быстро даже когда провайдер висит. Это осознанно
// жёстче боевых вызовов — здесь важно «доступен/нет», а не дождаться ответа.
const PROBE_TIMEOUT_MS = 10_000;

// Результат кешируется: открытая админка не должна дёргать провайдеров (и
// тратить деньги) на каждый рендер. Принудительная перепроверка — ?refresh=true.
const CACHE_TTL_MS = 60_000;

// Проба чата — один токен на самой дешёвой модели. Стоит доли цента, но, в
// отличие от GET /v1/models, ловит исчерпанную квоту: список моделей отдаётся
// и при нулевом балансе.
const CHAT_PROBE_MODEL = process.env.LLM_HEALTH_PROBE_MODEL || 'gpt-4o-mini';

export const STATUS = {
    OK: 'ok',
    // Сеть не пустила: DNS, TCP, TLS или таймаут. Ключи и баланс тут ни при чём.
    UNREACHABLE: 'unreachable',
    INVALID_KEY: 'invalid_key',
    NO_CREDITS: 'no_credits',
    RATE_LIMITED: 'rate_limited',
    // Провайдер ответил, но конфигурация не сходится: нет такой модели или
    // размерность вектора разъехалась с EMBEDDING_DIM.
    MISCONFIGURED: 'misconfigured',
    NOT_CONFIGURED: 'not_configured',
    ERROR: 'error'
};

// Статусы, при которых соответствующий контур работать не будет вообще.
// rate_limited сюда не входит: это временно и само проходит.
const HARD_FAILURES = new Set([
    STATUS.UNREACHABLE,
    STATUS.INVALID_KEY,
    STATUS.NO_CREDITS,
    STATUS.MISCONFIGURED,
    STATUS.NOT_CONFIGURED
]);

let cache = null;

function classifyError(error) {
    // Порядок важен: APIConnectionTimeoutError наследует APIConnectionError.
    if (error instanceof APIConnectionTimeoutError) {
        return { status: STATUS.UNREACHABLE, message: 'Таймаут соединения — провайдер не ответил вовремя' };
    }
    if (error instanceof APIConnectionError) {
        return { status: STATUS.UNREACHABLE, message: 'Соединение не установлено (DNS/TCP/TLS) — вероятно, с сервера нет доступа к провайдеру' };
    }

    if (error instanceof APIError) {
        if (error.status === 401 || error.status === 403) {
            return { status: STATUS.INVALID_KEY, message: 'Ключ отклонён провайдером' };
        }
        // 402 — так о нехватке средств сообщает OpenRouter; insufficient_quota — OpenAI.
        if (error.status === 402 || error.code === 'insufficient_quota') {
            return { status: STATUS.NO_CREDITS, message: 'Закончились средства на балансе провайдера' };
        }
        if (error.status === 429) {
            return { status: STATUS.RATE_LIMITED, message: 'Упёрлись в лимит запросов (деньги при этом есть)' };
        }
        if (error.status === 404) {
            return { status: STATUS.MISCONFIGURED, message: `Провайдер не знает такой модели: ${error.message}` };
        }
        return { status: STATUS.ERROR, message: `HTTP ${error.status}: ${error.message}` };
    }

    return { status: STATUS.ERROR, message: error?.message || 'Неизвестная ошибка' };
}

// Тот же разбор для «сырых» ответов fetch — у эндпоинтов OpenRouter
// (/key, /credits) нет методов в SDK, они дёргаются напрямую.
function classifyHttpStatus(httpStatus, body) {
    if (httpStatus === 401 || httpStatus === 403) {
        return { status: STATUS.INVALID_KEY, message: `Ключ отклонён провайдером (HTTP ${httpStatus})` };
    }
    if (httpStatus === 402) {
        return { status: STATUS.NO_CREDITS, message: 'Закончились средства на балансе провайдера' };
    }
    if (httpStatus === 429) {
        return { status: STATUS.RATE_LIMITED, message: 'Упёрлись в лимит запросов' };
    }
    return { status: STATUS.ERROR, message: `HTTP ${httpStatus}: ${String(body).slice(0, 200)}` };
}

function elapsed(startedAt) {
    return Date.now() - startedAt;
}

// --- Проверка 1. Чат агентов (прямой OpenAI) --------------------------------
async function checkChat() {
    if (!process.env.OPENAI_API_KEY) {
        return { status: STATUS.NOT_CONFIGURED, message: 'OPENAI_API_KEY не задан', model: CHAT_PROBE_MODEL };
    }

    const startedAt = Date.now();
    try {
        await openai.chat.completions.create(
            { model: CHAT_PROBE_MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] },
            { timeout: PROBE_TIMEOUT_MS, maxRetries: 0 }
        );
        return { status: STATUS.OK, message: 'Чат-модель отвечает', model: CHAT_PROBE_MODEL, latencyMs: elapsed(startedAt) };
    } catch (error) {
        return { ...classifyError(error), model: CHAT_PROBE_MODEL, latencyMs: elapsed(startedAt) };
    }
}

// --- Проверка 2. Ключ и баланс OpenRouter -----------------------------------
// Ключ и деньги берутся из двух разных эндпоинтов: /key знает только про лимит
// самого ключа (у ключа без лимита там null), а баланс аккаунта лежит в
// /credits. Поэтому баланс = total_credits - total_usage, а не limit_remaining.
async function checkOpenRouterAccount() {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { status: STATUS.NOT_CONFIGURED, message: 'Не задан ни OPENROUTER_API_KEY, ни OPENAI_API_KEY' };
    }

    const startedAt = Date.now();
    const headers = { Authorization: `Bearer ${apiKey}` };

    let keyInfo;
    try {
        const response = await fetch(`${openrouter.baseURL}/key`, { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        if (!response.ok) {
            return { ...classifyHttpStatus(response.status, await response.text()), latencyMs: elapsed(startedAt) };
        }
        ({ data: keyInfo } = await response.json());
    } catch (error) {
        return {
            status: STATUS.UNREACHABLE,
            message: `Соединение с OpenRouter не установлено: ${error?.message || error}`,
            latencyMs: elapsed(startedAt)
        };
    }

    const result = {
        status: STATUS.OK,
        message: 'Ключ действителен',
        latencyMs: elapsed(startedAt),
        isFreeTier: Boolean(keyInfo?.is_free_tier),
        keyUsageUsd: keyInfo?.usage ?? null,
        // null = на ключе не выставлен лимит. Это НЕ значит «денег нет» и не
        // значит «денег много» — про баланс аккаунта говорит balanceUsd ниже.
        keyLimitRemainingUsd: keyInfo?.limit_remaining ?? null
    };

    // Баланс — по возможности: на ключах без нужных прав /credits может
    // ответить отказом, и это не повод объявлять провайдера сломанным.
    try {
        const response = await fetch(`${openrouter.baseURL}/credits`, { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        if (response.ok) {
            const { data } = await response.json();
            const balance = Number(data?.total_credits ?? 0) - Number(data?.total_usage ?? 0);
            result.totalCreditsUsd = data?.total_credits ?? null;
            result.totalUsageUsd = data?.total_usage ?? null;
            result.balanceUsd = Number(balance.toFixed(4));

            if (result.balanceUsd <= 0) {
                result.status = STATUS.NO_CREDITS;
                result.message = 'Баланс аккаунта исчерпан';
            } else {
                result.message = `Ключ действителен, на балансе $${result.balanceUsd}`;
            }
        } else {
            result.balanceUsd = null;
            result.message = 'Ключ действителен; баланс недоступен (ключу не хватает прав на /credits)';
        }
    } catch {
        result.balanceUsd = null;
        result.message = 'Ключ действителен; баланс получить не удалось';
    }

    return result;
}

// --- Проверка 3. Эмбеддинги -------------------------------------------------
// Самая ценная из трёх: кроме доступности она сверяет РАЗМЕРНОСТЬ ответа с
// EMBEDDING_DIM. Расхождение — тихая поломка: коллекции Qdrant создаются под
// фиксированную размерность, и при несовпадении всё ломается уже на записи,
// далеко от места настоящей ошибки.
//
// Клиент дёргается напрямую, а не через embedText: тот заворачивает любую
// ошибку в EMBEDDING_PROVIDER_FAILED, теряя HTTP-статус, по которому и
// различаются «нет сети», «битый ключ» и «нет денег».
async function checkEmbeddings() {
    if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
        return { status: STATUS.NOT_CONFIGURED, message: 'Не задан ключ для эмбеддингов', model: EMBEDDING_MODEL, expectedDimensions: EMBEDDING_DIM };
    }

    const startedAt = Date.now();
    try {
        const response = await openrouter.embeddings.create(
            { model: EMBEDDING_MODEL, input: 'health check', dimensions: EMBEDDING_DIM },
            { timeout: PROBE_TIMEOUT_MS, maxRetries: 0 }
        );

        const dimensions = response?.data?.[0]?.embedding?.length ?? null;
        const base = { model: EMBEDDING_MODEL, dimensions, expectedDimensions: EMBEDDING_DIM, latencyMs: elapsed(startedAt) };

        if (dimensions !== EMBEDDING_DIM) {
            return {
                ...base,
                status: STATUS.MISCONFIGURED,
                message: `Размерность вектора ${dimensions} не совпадает с EMBEDDING_DIM=${EMBEDDING_DIM}. ` +
                    'Коллекции Qdrant созданы под другую размерность — нужен пересоздание коллекций и переиндексация.'
            };
        }

        return { ...base, status: STATUS.OK, message: 'Эмбеддинги отвечают, размерность совпадает' };
    } catch (error) {
        return {
            ...classifyError(error),
            model: EMBEDDING_MODEL,
            expectedDimensions: EMBEDDING_DIM,
            latencyMs: elapsed(startedAt)
        };
    }
}

function summarize(checks) {
    const statuses = Object.values(checks).map((check) => check.status);
    if (statuses.every((status) => status === STATUS.OK)) return STATUS.OK;
    if (statuses.some((status) => HARD_FAILURES.has(status))) return 'down';
    return 'degraded';
}

async function runChecks() {
    // Параллельно: три независимых провайдерских вызова, последовательный
    // прогон утроил бы время ответа на висящей сети.
    const [chat, openrouterAccount, embeddings] = await Promise.all([
        checkChat(),
        checkOpenRouterAccount(),
        checkEmbeddings()
    ]);

    const checks = { chat, openrouterAccount, embeddings };
    return { status: summarize(checks), checkedAt: new Date().toISOString(), checks };
}

export async function getLlmHealth({ refresh = false } = {}) {
    if (!refresh && cache && cache.expiresAt > Date.now()) {
        return { ...cache.result, cached: true };
    }

    const result = await runChecks();
    cache = { result, expiresAt: Date.now() + CACHE_TTL_MS };
    return { ...result, cached: false };
}

// Для тестов и для принудительного сброса после смены конфигурации.
export function resetLlmHealthCache() {
    cache = null;
}
