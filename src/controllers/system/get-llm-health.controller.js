import { getLlmHealth } from '../../services/llm-health.service.js';

export async function getLlmHealthStatus(req, res) {
    try {
        // Ответ кешируется на минуту, чтобы открытая админка не дёргала
        // провайдеров (и не тратила деньги) на каждый рендер. ?refresh=true —
        // принудительная перепроверка, например сразу после смены ключей.
        const refresh = req.query.refresh === 'true';
        const health = await getLlmHealth({ refresh });

        // Всегда 200: это отчёт о состоянии, а не результат операции. Отдавать
        // 503 при мёртвом провайдере значило бы, что сломалась сама
        // диагностика, — а она как раз отработала. Состояние читается из
        // data.status (ok | degraded | down).
        return res.success(health, 'Состояние LLM-провайдеров получено', 200);
    } catch (error) {
        return res.error({ description: error.message, code: 'LLM_HEALTH_CHECK_FAILED' }, 500, 'Не удалось проверить состояние LLM-провайдеров');
    }
}
