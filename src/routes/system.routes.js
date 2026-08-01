import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { checkPermission } from '../middlewares/permission.middleware.js';
import { getLlmHealthStatus } from '../controllers/system/get-llm-health.controller.js';

const DIAGNOSTICS = 'system_diagnostics.read';
const router = express.Router();

router.use(authMiddleware, checkPermission(DIAGNOSTICS));

/**
 * @swagger
 * /system/llm-health:
 *   get:
 *     tags: [System]
 *     summary: Состояние LLM-провайдеров
 *     description: |
 *       Живая диагностика провайдеров: доступны ли, валидны ли ключи, есть ли
 *       деньги, сходится ли размерность эмбеддингов с коллекциями Qdrant.
 *       Только для пользователей с правом `system_diagnostics.read`.
 *
 *       **Зачем.** Снаружи «агент не отвечает» выглядит одинаково, а внутри это
 *       разные ситуации с разными действиями. Эндпоинт их разделяет:
 *
 *       | `status` проверки | Что случилось | Что делать |
 *       |---|---|---|
 *       | `ok` | всё работает | — |
 *       | `unreachable` | сеть не пустила (DNS/TCP/TLS/таймаут) | смотреть доступ с сервера к провайдеру, а не ключи |
 *       | `invalid_key` | ключ отклонён | перевыпустить ключ |
 *       | `no_credits` | закончились деньги | пополнить баланс |
 *       | `rate_limited` | лимит запросов (деньги есть) | подождать |
 *       | `misconfigured` | нет такой модели или размерность вектора ≠ `EMBEDDING_DIM` | починить конфигурацию; при смене размерности — пересоздать коллекции Qdrant и переиндексировать |
 *       | `not_configured` | ключ не задан в окружении | задать переменную |
 *
 *       **Три проверки, потому что провайдера два и падают они независимо:**
 *       `chat` — прямой OpenAI (чат агентов study и акселератора);
 *       `openrouterAccount` — ключ и баланс OpenRouter;
 *       `embeddings` — реальная векторизация через OpenRouter со сверкой размерности.
 *       Умерший OpenRouter не трогает study, но полностью останавливает
 *       акселератор: сборка контекста начинается с векторного поиска.
 *
 *       **Итоговый `status`:** `ok` — все проверки прошли; `down` — есть
 *       блокирующая проблема; `degraded` — есть небезопасная, но не
 *       блокирующая (например, `rate_limited`).
 *
 *       Каждая проверка — реальный сетевой вызов (проба чата стоит доли цента),
 *       поэтому результат кешируется на 60 секунд.
 *
 *       HTTP-код всегда `200`, даже когда провайдеры лежат: это отчёт о
 *       состоянии, а не результат операции. Смотрите `data.status`.
 *     parameters:
 *       - in: query
 *         name: refresh
 *         required: false
 *         schema: { type: string, enum: ['true'] }
 *         description: Игнорировать кеш и проверить провайдеров заново (например, сразу после смены ключей).
 *     responses:
 *       200:
 *         description: Отчёт о состоянии провайдеров
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, enum: [ok, degraded, down] }
 *                     checkedAt: { type: string, format: date-time }
 *                     cached: { type: boolean, description: "true — ответ из кеша (моложе 60 секунд), сеть не дёргалась." }
 *                     checks:
 *                       type: object
 *                       properties:
 *                         chat:
 *                           type: object
 *                           properties:
 *                             status: { type: string }
 *                             message: { type: string }
 *                             model: { type: string }
 *                             latencyMs: { type: integer }
 *                         openrouterAccount:
 *                           type: object
 *                           properties:
 *                             status: { type: string }
 *                             message: { type: string }
 *                             balanceUsd: { type: number, nullable: true, description: "Остаток на аккаунте: total_credits - total_usage. null — ключу не хватает прав на /credits." }
 *                             totalCreditsUsd: { type: number, nullable: true }
 *                             totalUsageUsd: { type: number, nullable: true }
 *                             keyLimitRemainingUsd: { type: number, nullable: true, description: "Остаток лимита САМОГО КЛЮЧА. null — лимит на ключе не выставлен; это не про баланс аккаунта." }
 *                             isFreeTier: { type: boolean }
 *                             latencyMs: { type: integer }
 *                         embeddings:
 *                           type: object
 *                           properties:
 *                             status: { type: string }
 *                             message: { type: string }
 *                             model: { type: string }
 *                             dimensions: { type: integer, nullable: true, description: "Размерность, которую вернул провайдер." }
 *                             expectedDimensions: { type: integer, description: "EMBEDDING_DIM — под неё созданы коллекции Qdrant." }
 *                             latencyMs: { type: integer }
 *       401: { description: Требуется авторизация }
 *       403: { description: Недостаточно прав }
 */
router.get('/llm-health', getLlmHealthStatus);

export default router;
