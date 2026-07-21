/**
 * @swagger
 * components:
 *   schemas:
 *     AcceleratorAgent:
 *       type: object
 *       description: Универсальный AI-агент Р-Акселератора. Заводится администратором через этот же CRUD — в системе нет захардкоженного набора R1-R5, агент идентифицируется своим _id.
 *       properties:
 *         _id:
 *           type: string
 *           description: Идентификатор агента. Единственный способ на него сослаться — отдельного человекочитаемого кода нет (см. nextAgentId).
 *         name:
 *           type: string
 *           description: Имя агента для интерфейса ("Роман"). В промпт модели не попадает — чисто отображаемое поле.
 *         roleTitle:
 *           type: string
 *           description: Короткое описание специализации ("Эксперт по рынку и нише"). Тоже только для UI, в промпт не подмешивается.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Развёрнутое описание агента для UI (карточка агента) — чем он занимается. Необязательное, в промпт модели не подмешивается.
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *           description: Ссылка на аватарку агента (изображение) для UI. Необязательное, в промпт не подмешивается.
 *         order:
 *           type: integer
 *           description: Порядковое место агента в маршруте. По нему сортируется список агентов и выбирается "первый активный агент", если у проекта ещё не выставлен текущий.
 *         isActive:
 *           type: boolean
 *           description: Если false — агент не участвует в пользовательском маршруте (нельзя открыть с ним сессию), но его данные и уже созданные артефакты не удаляются.
 *         systemPrompt:
 *           type: string
 *           description: Базовая системная инструкция роли — первый и главный блок системного промпта, который реально уходит в LLM при каждом сообщении и при генерации артефакта. Виден только пользователям с правом accelerator_agents.manage.
 *         completionCriteria:
 *           type: string
 *           description: Текстовое описание того, когда этап считается завершённым. Добавляется в промпт как инструкция для модели — сервер не проверяет это как обязательное условие перед вызовом complete.
 *         artifactDefinition:
 *           type: object
 *           description: Описание структуры финального артефакта этапа — используется и в промпте (модели явно говорят, какие поля заполнить), и при проверке её ответа.
 *           properties:
 *             artifactType:
 *               type: string
 *               description: Тип артефакта ("market_brief") — попадает в Artifact.type.
 *             titleTemplate:
 *               type: string
 *               nullable: true
 *               description: Шаблон заголовка артефакта. Если не задан, заголовок собирается автоматически из имени агента и artifactType.
 *             requiredFields:
 *               type: array
 *               items: { type: string }
 *               description: Ключи JSON, которые модель обязана заполнить непустыми значениями при генерации артефакта. Отсутствие любого поля в ответе модели даёт ошибку ARTIFACT_VALIDATION_FAILED.
 *             outputSchema:
 *               type: object
 *               nullable: true
 *               description: Необязательная полноценная JSON Schema для более строгой проверки ответа модели (типы полей, а не только "поле не пустое"). Если схема сама невалидна как JSON Schema, проверка тихо пропускается.
 *             summaryField:
 *               type: string
 *               default: summary
 *               description: Какое поле сгенерированного JSON использовать как краткую сводку артефакта — эта сводка попадает и в Project.contextSummary, и в индексируемый текст в Qdrant.
 *         nextAgentId:
 *           type: string
 *           nullable: true
 *           description: _id следующего агента маршрута. При подтверждении артефакта (confirmArtifact=true) Project.currentAgentId переключается на это значение; null — маршрут для проекта заканчивается на этом агенте.
 *         contextPolicy:
 *           type: object
 *           description: Настройки того, какой контекст подмешивать этому агенту в промпт.
 *           properties:
 *             includeProjectSummary:
 *               type: boolean
 *               description: Включать ли Project.contextSummary в системный промпт этого агента.
 *             includePreviousArtifacts:
 *               type: boolean
 *               description: Включать ли артефакты предыдущих этапов (sourceType=artifact) в поиск по Qdrant для этого агента.
 *             qdrantTopK:
 *               type: integer
 *               description: Сколько фрагментов забирать из Qdrant-поиска (топ-K по релевантности).
 *             maxContextChars:
 *               type: integer
 *               description: Верхний лимит суммарной длины найденного в Qdrant контекста в символах — защита от разрастания промпта.
 *             allowedSourceTypes:
 *               type: array
 *               items: { type: string, enum: [project_summary, agent_summary, artifact, file_chunk, user_note] }
 *               description: Какие типы источников участвуют в Qdrant-поиске для этого агента.
 *             knowledgeTopK:
 *               type: integer
 *               description: Сколько фрагментов забирать из базы знаний (knowledge_context) по привязанным knowledgeIds.
 *             knowledgeMaxContextChars:
 *               type: integer
 *               description: Отдельный лимит суммарной длины knowledge-контекста в символах.
 *         knowledgeIds:
 *           type: array
 *           items: { type: string }
 *           description: _id глобальных баз знаний (Knowledge), привязанных агенту. Поиск в knowledge_context идёт только по этому списку; пустой список — агент не получает знаний.
 *         modelConfig:
 *           type: object
 *           description: Настройки конкретного LLM-вызова для этого агента. Провайдер сейчас всегда OpenAI.
 *           properties:
 *             model:
 *               type: string
 *               description: Имя модели OpenAI ("gpt-4o-mini").
 *             temperature:
 *               type: number
 *               description: Температура генерации — выше значение, разнообразнее и менее предсказуемее ответы.
 *             maxTokens:
 *               type: integer
 *               description: Лимит токенов на ответ модели (не на входной контекст — тот ограничивается maxContextChars).
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Момент создания агента.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Момент последнего изменения агента.
 */
