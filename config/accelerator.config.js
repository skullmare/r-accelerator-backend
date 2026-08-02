// Единственное место, где заданы технические параметры Акселератора.
//
// Раньше всё это лежало в самом агенте (modelConfig, contextPolicy) — по
// настройке на каждого агента, десятки полей, которые администратор заполнял
// вслепую и которые расходились между агентами. Поведение агента задаётся
// промптом, а не тюнингом topK: технические параметры одинаковы для всего
// сервиса и меняются здесь (или переменными окружения), а не в карточке
// агента.

function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export const LLM = {
    // Модель для всех вызовов Акселератора: и реплики в чате, и генерация
    // документа артефакта.
    model: process.env.ACCELERATOR_LLM_MODEL || 'gpt-4o-mini',
    temperature: num(process.env.ACCELERATOR_LLM_TEMPERATURE, 0.4),
    // Лимит токенов на реплику агента в чате.
    chatMaxTokens: num(process.env.ACCELERATOR_LLM_CHAT_MAX_TOKENS, 1500),
    // Документ артефакта заметно длиннее реплики — свой лимит.
    documentMaxTokens: num(process.env.ACCELERATOR_LLM_DOCUMENT_MAX_TOKENS, 4000)
};

export const CONTEXT = {
    // Сколько последних сообщений сессии уходит в модель.
    historyLimit: 30,
    // Поиск по приватному контексту проекта (expert_context).
    projectTopK: 6,
    projectMaxChars: 6000,
    // Поиск по базам знаний, привязанным агенту (knowledge_context).
    knowledgeTopK: 6,
    knowledgeMaxChars: 6000,
    // Какие типы источников участвуют в поиске по контексту проекта.
    sourceTypes: ['project_summary', 'artifact', 'file_chunk']
};
