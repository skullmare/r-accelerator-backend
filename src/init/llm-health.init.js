import { getLlmHealth, STATUS } from '../services/llm-health.service.js';
import logger from '../../config/logger.config.js';

const LABELS = {
    chat: 'Чат агентов (OpenAI)',
    openrouterAccount: 'Аккаунт OpenRouter',
    embeddings: 'Эмбеддинги'
};

// Диагностика провайдеров на старте. Намеренно НЕ блокирует запуск и не роняет
// процесс: моргнувший провайдер не должен мешать серверу подняться — всё, что
// не про агентов (админка, авторизация, файлы), продолжает работать. Задача
// проверки — чтобы причина будущих «агент не отвечает» лежала в логе сразу,
// а не искалась потом руками.
export async function logLlmHealthOnStartup() {
    let health;
    try {
        health = await getLlmHealth({ refresh: true });
    } catch (error) {
        logger.warn(`Диагностика LLM не выполнилась: ${error.message}`);
        return;
    }

    for (const [name, check] of Object.entries(health.checks)) {
        const label = LABELS[name] || name;
        if (check.status === STATUS.OK) {
            logger.info(`LLM · ${label}: ${check.message}`);
        } else {
            logger.warn(`LLM · ${label}: [${check.status}] ${check.message}`);
        }
    }

    if (health.status !== STATUS.OK) {
        logger.warn(
            `Итог диагностики LLM: ${health.status}. Подробности — GET /api/v1/system/llm-health ` +
            '(право system_diagnostics.read).'
        );
    }
}
