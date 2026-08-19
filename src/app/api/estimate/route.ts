import { NextRequest, NextResponse } from 'next/server';
import {
  enforceComplexityFloor,
  getEstimationGuardrails,
  normalizeEstimate,
  PROJECT_PROFILES,
  type Complexity,
  type ModelEstimate,
} from '@/lib/estimation';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Groq — основной провайдер, NVIDIA — fallback
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const PRIMARY_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
const FALLBACK_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const API_TIMEOUT = 120000; // 120 секунд на запрос

// Max chars for single-call mode. Above this → per-file analysis.
const SINGLE_CALL_LIMIT = 120000;

interface EstimateRequest {
  phase?: 'analyze' | 'price';
  projectType: string;
  projectTypeCustom?: string;
  complexity?: string;
  features: string[];
  customFeatures: string[];
  description: string;
  techStack: string[];
  designNeeded: boolean;
  urgentDeadline: boolean;
  clarifications?: Record<string, string>;
}

interface EstimateResponse {
  baseHours: number;
  testingHours: number;
  testingPercent: number;
  totalHours: number;
  productiveHoursPerDay: number;
  days: number;
  dailyRate: number;
  operationalExpenses: number;
  priceMin: number;
  priceMax: number;
  daysMin: number;
  daysMax: number;
  detectedComplexity?: string;
  estimationBasis: string;
  guardrailsApplied: string[];
  breakdown: {
    category: string;
    hours: number;
  }[];
  studioComparison: {
    priceMin: number;
    priceMax: number;
    daysMin: number;
    daysMax: number;
  };
  recommendations: string[];
}

const SYSTEM_PROMPT_SHORT = `Ты — оценщик для ОДНОГО разработчика, который пишет код с помощью AI и готовых библиотек. Твои оценки ДЕШЁВЫЕ и реалистичные, как у фрилансера/инди-разработчика, а НЕ как у IT-студии.

КРИТИЧЕСКИ ВАЖНО: Тип проекта, указанный в контексте — это ТОЛЬКО подсказка UI (кнопка формы). НЕ УЧИТЫВАЙ ЕЁ. Определи реальный тип и модули ТОЛЬКО по описанию/ТЗ. Если ТЗ описывает полноценную платформу — так и оценивай, даже если выбран «Telegram бот» или «Лендинг».

AI ускоряет написание и поиск решений, но не отменяет анализ требований, архитектуру, интеграцию, безопасность, ручную проверку, исправление ошибок, нагрузочные проверки, деплой и приемку.

Классификация типа (detectedType) — СТРОГО один из:
landing, corporate, ecommerce, webapp, social, game, marketplace, mobile, telegram, crm, api, custom.
- social (соцсеть) — ТОЛЬКО настоящая соцсеть с лентой/профилями/подписками (VK, Instagram, TikTok, Facebook).
- «Образовательная платформа», «платформа для бизнеса», «платформа услуг» и т.п. — это custom или webapp, НЕ social. «Платформа» ≠ соцсеть.

Правила:
1. Источник правды — описание и ТЗ. Поля формы являются подсказками.
2. Короткое описание известного продукта раскрывай до реального набора подсистем.
3. "Аналог Ozon", Wildberries, Avito, Instagram и других крупных сервисов — это крупная платформа, а не несколько экранов.
4. Каждый реально присутствующий в ТЗ модуль оценивай отдельно по размеру (маленький до 8ч / средний 8–20ч / большой >20ч). Не укрупняй и не прячь подсистемы.
5. Сроки реалистичные: для индивидуального проекта из нескольких подсистем (масштаб NOMAD) — максимум 15 рабочих дней, а не 30.
6. Оценивай базовые часы модулей до тестирования. Сервер сам добавит QA, сроки, ставку и стоимость.
7. Не занижай модуль до минут только потому, что код помогает писать AI.
8. Объединяй связанные мелочи, но не скрывай отдельные продуктовые подсистемы.
9. Отвечай только валидным JSON на русском языке.`;

const SYSTEM_PROMPT = `${SYSTEM_PROMPT_SHORT}

При оценке учитывай весь цикл рабочего результата:
- уточнение поведения и граничных случаев;
- схема данных, роли и права доступа;
- frontend, backend и внешние интеграции;
- состояния загрузки, ошибок и восстановления;
- безопасность, журналирование и мониторинг;
- тестовые данные, автоматические и ручные проверки;
- миграции, CI/CD, деплой и документация.

Готовый UI-кит, SDK или AI-генерация сокращают реализацию типового кода, но их все равно нужно адаптировать, связать с данными, проверить и стабилизировать.

Для маркетплейсов обязательно раскрывай контуры покупателя, продавца и оператора: каталог, поиск, остатки, корзина, платежи, выплаты, заказы, возвраты, споры, логистика, модерация, поддержка, безопасность и нагрузка.

Для рекомендаций пиши заказчику простым языком о границах MVP, скрытых регулярных расходах, этапах запуска и критериях приемки.`;

function selectSystemPrompt(totalChars: number): string {
  return totalChars > 100000 ? SYSTEM_PROMPT_SHORT : SYSTEM_PROMPT;
}

// ══════════════════════════════════════
// ══════════════════════════════════════
// API CALL — NVIDIA primary, Groq fallback
// ══════════════════════════════════════

async function callAI(messages: { role: string; content: string }[], maxTokens: number): Promise<string> {
  if (!GROQ_API_KEY && !NVIDIA_API_KEY) {
    throw new Error('API ключи не настроены');
  }

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);

  // Groq — основной, NVIDIA — fallback
  const providers = [
    ...(GROQ_API_KEY ? [{ name: 'Groq', model: PRIMARY_MODEL, url: PRIMARY_URL, key: GROQ_API_KEY }] : []),
    ...(NVIDIA_API_KEY ? [{ name: 'NVIDIA', model: FALLBACK_MODEL, url: FALLBACK_URL, key: NVIDIA_API_KEY }] : []),
  ];

  if (providers.length === 0) {
    throw new Error('Нет доступных API ключей');
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    console.log(`[AI] Trying ${provider.name} ${provider.model}, total chars: ${totalChars}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: 0.5,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`${provider.name} API error: ${response.status} — ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        throw new Error(`${provider.name}: модель вернула пустой ответ`);
      }

      console.log(`[AI] ${provider.name} ${provider.model} success!`);
      return content;
    } catch (err) {
      const error = err as Error;
      console.error(`[AI] ${provider.name} error:`, error.message);
      lastError = error;
      if (error.name === 'AbortError' || error.message.includes('API error: 5') || error.message.includes('ECONNREFUSED')) {
        console.log(`[AI] Falling back to next provider...`);
        continue;
      }
      if (error.message.includes('API error: 4')) {
        console.log(`[AI] Provider returned 4xx, trying fallback...`);
        continue;
      }
      continue;
    }
  }

  throw new Error(`Сервис временно недоступен: ${lastError?.message}`);
}

// ══════════════════════════════════════
// FILE SPLITTING & PER-FILE ANALYSIS
// ══════════════════════════════════════

interface ParsedFile {
  name: string;
  content: string;
}

function splitFiles(text: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const regex = /===== ФАЙЛ: (.+?) =====\n([\s\S]*?)(?=\n\n===== ФАЙЛ: |$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    files.push({ name: match[1].trim(), content: match[2].trim() });
  }
  return files;
}

async function summarizeFiles(files: ParsedFile[]): Promise<string> {
  const summaries: string[] = [];

  for (const file of files) {
    const otherFiles = files.filter(f => f.name !== file.name).map(f => f.name).join(', ');

    try {
      const result = await callAI([
        { role: 'system', content: 'Ты — аналитик IT-проектов. Извлекай из документа все модули, функции и требования. Отвечай СТРОГО в JSON на русском языке.' },
        {
          role: 'user', content: `Извлеки из документа "${file.name}" (${file.content.length} символов) все ключевые модули и функции для оценки стоимости IT-проекта.

Другие файлы проекта: ${otherFiles}

ДОКУМЕНТ:
${file.content}

Ответь СТРОГО в JSON:
{
  "modules": [{"name": "название модуля", "details": "ключевые детали и требования", "items": "количество единиц если есть (ачивки, товары и т.п.)"}],
  "techStack": ["технологии из документа"],
  "integrations": ["интеграции с внешними сервисами"],
  "pages": "примерное количество страниц/экранов",
  "complexity": "простой|средний|сложный"
}` }
      ], 3000);

      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          const modulesList = (data.modules || []).map((m: { name: string; details?: string; items?: string }) =>
            `  • ${m.name}${m.details ? `: ${m.details}` : ''}${m.items ? ` (${m.items} ед.)` : ''}`
          ).join('\n');
          summaries.push(
            `━━━ ФАЙЛ: ${file.name} ━━━\n` +
            `Модули:\n${modulesList || '  не найдены'}\n` +
            `Стек: ${(data.techStack || []).join(', ') || 'не указан'}\n` +
            `Интеграции: ${(data.integrations || []).join(', ') || 'нет'}\n` +
            `Страниц/экранов: ${data.pages || '?'}\n` +
            `Сложность файла: ${data.complexity || '?'}`
          );
        } else {
          summaries.push(`━━━ ФАЙЛ: ${file.name} ━━━\n${result.slice(0, 2000)}`);
        }
      } catch {
        summaries.push(`━━━ ФАЙЛ: ${file.name} ━━━\n${result.slice(0, 2000)}`);
      }
    } catch (error) {
      console.error(`File summary failed for "${file.name}":`, error);
      summaries.push(`━━━ ФАЙЛ: ${file.name} ━━━\n[Ошибка анализа, первые 3000 символов:]\n${file.content.slice(0, 3000)}`);
    }
  }

  return summaries.join('\n\n');
}

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════

function getTypeLabel(projectType: string, projectTypeCustom?: string): string {
  const typeLabels: Record<string, string> = {
    landing: 'Лендинг / Визитка',
    corporate: 'Корпоративный сайт',
    ecommerce: 'Интернет-магазин',
    webapp: 'Веб-приложение (SaaS)',
    social: 'Социальная сеть (SNS: VK/Instagram/TikTok)',
    game: 'Игровая платформа',
    marketplace: 'Маркетплейс',
    mobile: 'Мобильное приложение',
    telegram: 'Telegram бот',
    crm: 'CRM / Админ-панель',
    api: 'API / Backend',
  };

  if (projectType === 'custom') {
    return `Пользователь описал как: "${projectTypeCustom || 'не указано'}". Проанализируй описание/ТЗ и определи реальный тип проекта самостоятельно.`;
  }
  return typeLabels[projectType] || projectType;
}

function buildProjectContext(body: EstimateRequest, description: string, hasFullTZ: boolean, isSummarized?: boolean): string {
  const actualType = getTypeLabel(body.projectType, body.projectTypeCustom);
  const allFeatures = [...(body.features || []), ...(body.customFeatures || [])];
  const guardrails = getEstimationGuardrails({
    projectType: body.projectType,
    description,
    clarifications: body.clarifications,
    designNeeded: body.designNeeded,
  });

  const tzLabel = isSummarized
    ? '⚠️ ТЗ из нескольких файлов — ниже структурированный анализ каждого файла. Учитывай ВСЕ модули из ВСЕХ файлов!'
    : hasFullTZ
      ? '⚠️ ВНИМАНИЕ: Приложено ПОЛНОЕ ТЗ — анализируй ВСЕ разделы и модули из него!'
      : '';

  // Определяем, короткое ли описание
  const isShortDesc = description.length < 500;
  const shortDescWarning = isShortDesc
    ? `\n⚠️ ОПИСАНИЕ КОРОТКОЕ (${description.length} символов). Это НЕ значит, что проект простой! Ты ОБЯЗАН разложить проект на полный набор модулей на основе ТИПА ПРОЕКТА и справочника типичных модулей.\n`
    : '';

  const cloneInfo = guardrails.knownClone
    ? `\n⚠️ Обнаружен аналог ${guardrails.knownClone.label}. Это ${guardrails.profile.label} уровня ${guardrails.complexityFloor}; нельзя оценивать его как набор нескольких экранов.\n`
    : '';

  return `${tzLabel}${shortDescWarning}${cloneInfo}

СЕРВЕРНЫЕ ОГРАНИЧЕНИЯ ОЦЕНКИ:
- Реальный профиль: ${guardrails.profile.label}
- Минимум до тестирования: ${guardrails.requiredBaseHours} базовых часов
- Минимальный уровень сложности: ${guardrails.complexityFloor}
- Минимальный срок: ${guardrails.minimumWorkingDays} рабочих дней
- Основания: ${guardrails.reasons.join('; ')}

ОПИСАНИЕ/ТЗ:
${description}

Функции из формы (ПОДСКАЗКИ — учитывай ТОЛЬКО если НЕ описаны в ТЗ, не дублируй!): ${allFeatures.length > 0 ? allFeatures.join(', ') : 'не выбраны'}
Технологии: ${body.techStack.length > 0 ? body.techStack.join(', ') : 'на усмотрение разработчика'}
Дизайн (UI/UX): ${body.designNeeded ? 'нужен кастомный дизайн' : 'не нужен'}
Срочность: ${body.urgentDeadline ? 'срочный приоритет, объем работ не сокращается' : 'стандартные сроки'}`;
}

// Resolve description: if too large and has files → per-file analysis
async function resolveDescription(rawDesc: string): Promise<{ text: string; isSummarized: boolean }> {
  if (rawDesc.length <= SINGLE_CALL_LIMIT) {
    return { text: rawDesc, isSummarized: false };
  }

  const files = splitFiles(rawDesc);

  if (files.length >= 2) {
    console.log(`[Per-file] Total ${rawDesc.length} chars, ${files.length} files — analyzing each separately`);
    const summaries = await summarizeFiles(files);
    return { text: summaries, isSummarized: true };
  }

  // No file markers or single file — just truncate (edge case)
  const half = Math.floor(SINGLE_CALL_LIMIT / 2);
  const truncated = rawDesc.slice(0, half) + `\n\n... [содержимое сокращено — ${rawDesc.length - SINGLE_CALL_LIMIT} символов пропущено] ...\n\n` + rawDesc.slice(-half);
  return { text: truncated, isSummarized: false };
}

// ══════════════════════════════════════
// PHASE 1: Analysis + Clarifying Questions
// ══════════════════════════════════════

async function handleAnalyzePhase(body: EstimateRequest, rawDesc: string): Promise<NextResponse> {
  const hasFullTZ = rawDesc.length > 5000;
  const { text: description, isSummarized } = await resolveDescription(rawDesc);
  const projectContext = buildProjectContext(body, description, hasFullTZ, isSummarized);

  const guardrails = getEstimationGuardrails({
    projectType: body.projectType,
    description,
    designNeeded: body.designNeeded,
  });
  const referenceCatalog = PROJECT_PROFILES[guardrails.effectiveType] || PROJECT_PROFILES.custom;
  const isShortDesc = description.length < 500;

  let referenceSection = '';
  if (isShortDesc || guardrails.knownClone) {
    referenceSection = `\n\n📋 ОБЯЗАТЕЛЬНЫЙ СОСТАВ ПРОФИЛЯ "${referenceCatalog.label.toUpperCase()}":
${referenceCatalog.typicalModules.map(m => `  • ${m.category} (${m.hours}ч)`).join('\n')}
  Серверный минимум: ${guardrails.requiredBaseHours} базовых часов до тестирования.
  Нельзя сокращать продукт до нескольких экранов или CRUD-таблиц.`;
  }

  const analysisPrompt = `Проанализируй проект и задай уточняющие вопросы для точной оценки стоимости.

${projectContext}${referenceSection}

ЗАДАЧА:
1. Определи реальную сложность проекта на основе содержания ТЗ/описания, ТИПА ПРОЕКТА и справочника модулей (если предоставлен).
2. Если описание КОРОТКОЕ — определи реальный масштаб по типу проекта. "Аналог Ozon" = enterprise-маркетплейс минимум ${guardrails.requiredBaseHours} базовых часов, а не "простой магазин".
  3. Определи реальный тип проекта по ТЗ. Используй ТОЛЬКО значения: landing, corporate, ecommerce, webapp, social, game, marketplace, mobile, telegram, crm, api, custom. social — только настоящая соцсеть (VK/Instagram/TikTok); «образовательная платформа» и прочие «платформы» — это custom/webapp, НЕ social.
4. Найди НЕЯСНОСТИ, ПРОТИВОРЕЧИЯ и ПРОПУСКИ в описании, которые влияют на цену.
5. Сформулируй уточняющие вопросы.

ПРАВИЛА ДЛЯ ВОПРОСОВ:
- Задавай вопросы АКТИВНО — лучше больше, чем меньше.
- Каждый вопрос должен иметь конкретные варианты ответа (2-4 варианта).
- Если ТЗ подробное и исчерпывающее (>5000 символов) — задай 2-5 вопросов.
- Если описание короткое (<500 символов) — задай 8-15 вопросов.
- Если описание среднее (500-5000 символов) — задай 5-10 вопросов.
- **Если что-то НЕЯСНО в описании — ОБЯЗАТЕЛЬНО спрашивай.** Не додумывай сам.
- НЕ спрашивай то, что уже ясно из описания.
- Приоритетные темы: масштаб (пользователи/нагрузка), платёжная система, админ-панель, мобильная версия, интеграции, безопасность, контент, дизайн.

Ответь СТРОГО в JSON формате:
{
  "detectedComplexity": "простой|средний|сложный|enterprise",
  "detectedType": "реальный тип проекта по ТЗ",
  "questions": [
    {"id": "q1", "question": "текст вопроса", "options": ["вариант 1", "вариант 2", "вариант 3"], "priority": "high|medium|low"}
  ],
  "analysis": "краткое резюме проекта в 2-3 предложениях"
}`;

  let result = '';
  let lastError: Error | null = null;

  try {
    result = await callAI([
      { role: 'system', content: 'Ты — аналитик IT-проектов. Задавай умные уточняющие вопросы для оценки стоимости. Отвечай ТОЛЬКО в JSON на русском языке.' },
      { role: 'user', content: analysisPrompt }
    ], 4000);
  } catch (error) {
    lastError = error as Error;
    console.error('Analysis call failed:', error);
  }

  if (!result) {
    return NextResponse.json(
      { error: 'Сервис временно недоступен. Попробуйте позже.', details: lastError?.message },
      { status: 503 }
    );
  }

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Analysis JSON parse failed. Raw response:', result.slice(0, 500));
    return NextResponse.json(
      { error: 'Не удалось проанализировать проект. Попробуйте ещё раз.' },
      { status: 500 }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Analysis JSON.parse failed:', e, 'Extracted:', jsonMatch[0].slice(0, 300));
    return NextResponse.json(
      { error: 'Модель вернула некорректный ответ. Попробуйте ещё раз.' },
      { status: 500 }
    );
  }

  const allowedComplexities: Complexity[] = ['простой', 'средний', 'сложный', 'enterprise'];
  const modelComplexity = allowedComplexities.includes(parsed.detectedComplexity)
    ? parsed.detectedComplexity as Complexity
    : 'простой';

  return NextResponse.json({
    questions: parsed.questions || [],
    detectedComplexity: enforceComplexityFloor(modelComplexity, guardrails.complexityFloor),
    detectedType: parsed.detectedType || '',
    analysis: parsed.analysis || '',
    ...(isSummarized ? { filesAnalyzed: splitFiles(rawDesc).length } : {}),
  });
}

// Детерминированная классификация типа по ТЗ (без ИИ) — нужна для запасного
// расчёта, чтобы заказчик ВСЕГДА получал хоть приблизительную оценку.
function classifyTypeFromText(text: string, fallbackType: string): string {
  const t = (text || '').toLowerCase();
  if (/(образовател|платформ|курс|обучен|тренаж|автошкол|школ)/.test(t)) return 'custom';
  if (/маркетплейс/.test(t)) return 'marketplace';
  if (/(магазин|товар|заказ|корзин|доставк|оплат)/.test(t)) return 'ecommerce';
  if (/(соцсет|лента|подписчик|профиль пользовател|instagram|tiktok|вконтакте|vk\.ru)/.test(t)) return 'social';
  if (/(телеграм|telegram|tg-бот|тг-бот|\sбот\b)/.test(t)) return 'telegram';
  if (/(мобильн|android|ios|приложен)/.test(t)) return 'mobile';
  if (/(игра|game)/.test(t)) return 'game';
  if (/(лендинг|одностранич)/.test(t)) return 'landing';
  if (/(корпоратив|сайт компан|визитк)/.test(t)) return 'corporate';
  if (/(crm|клиент|сделк)/.test(t)) return 'crm';
  if (/(api|бэкенд|backend|сервер)/.test(t)) return 'api';
  return fallbackType;
}

// Запасной расчёт: если ИИ недоступен/вернул ерунду, считаем по ТЗ и
// резюме-коридору выбранного типа. Заказчик всегда получает число.
function fallbackPricing(
  body: EstimateRequest,
  description: string,
): EstimateResponse {
  const detectedType = classifyTypeFromText(description, body.projectType);
  const estimate = normalizeEstimate({
    modelEstimate: { detectedType, breakdown: [], recommendations: [] },
    projectType: body.projectType,
    description,
    clarifications: body.clarifications,
    designNeeded: body.designNeeded,
    urgentDeadline: body.urgentDeadline,
  });
  estimate.approximate = true;
  return estimate;
}

// ══════════════════════════════════════
// PHASE 2: Pricing
// ══════════════════════════════════════

async function handlePricingPhase(body: EstimateRequest, rawDesc: string): Promise<NextResponse> {
  const hasFullTZ = rawDesc.length > 5000;
  const { text: description, isSummarized } = await resolveDescription(rawDesc);
  const projectContext = buildProjectContext(body, description, hasFullTZ, isSummarized);

  const guardrails = getEstimationGuardrails({
    projectType: body.projectType,
    description,
    clarifications: body.clarifications,
    designNeeded: body.designNeeded,
  });
  const referenceCatalog = PROJECT_PROFILES[guardrails.effectiveType] || PROJECT_PROFILES.custom;
  const isShortDesc = description.length < 500;

  let referenceSection = '';
  if (isShortDesc || guardrails.knownClone) {
    referenceSection = `\n\n📋 ОБЯЗАТЕЛЬНЫЙ СОСТАВ ПРОФИЛЯ "${referenceCatalog.label.toUpperCase()}":
${referenceCatalog.typicalModules.map(m => `  • ${m.category} (${m.hours}ч)`).join('\n')}
  Минимум до тестирования: ${guardrails.requiredBaseHours} базовых часов.
  Это нижняя граница, а не рекомендуемая итоговая оценка.`;
  }

  // Build clarifications text from user answers
  let clarificationsText = '';
  if (body.clarifications && Object.keys(body.clarifications).length > 0) {
    clarificationsText = '\n\nУТОЧНЕНИЯ ОТ КЛИЕНТА:\n' +
      Object.entries(body.clarifications)
        .map(([q, a]) => `• ${q}: ${a}`)
        .join('\n');
  }

  const pricingPrompt = `Разложи проект на рабочие модули и оцени БАЗОВЫЕ часы реализации до тестирования.

${projectContext}${referenceSection}${clarificationsText}

ПРАВИЛА:
- НЕ УЧИТЫВАЙ выбранную кнопку типа проекта — она является только подсказкой для UI. Определи реальный тип и модули ТОЛЬКО по описанию/ТЗ.
- Если ТЗ описывает полноценную платформу (backend, админка, боты, мобильное) — оценивай как полноценную платформу, даже если выбран «Telegram бот» или «Лендинг».
- Учитывай уточнения клиента и все файлы ТЗ.
- Не дублируй функции, которые одновременно указаны в форме и описании.
- Для известного аналога раскрывай все продуктовые контуры, а не только внешний интерфейс.
- AI и готовые библиотеки ускоряют типовой код, но не отменяют настройку, интеграцию, граничные случаи и проверку результата.
- Не добавляй тестирование, запас, стоимость, ставку или сравнение со студией: сервер рассчитает их сам.
- Сумма breakdown не должна быть меньше ${guardrails.requiredBaseHours} базовых часов.
- Для крупного проекта используй 12-25 содержательных строк; для небольшого 5-12.
${isSummarized ? '- ТЗ проанализировано пофайлово: собери требования из всех файлов в единый breakdown.\n' : ''}

Ответь ТОЛЬКО валидным JSON на русском языке:
{
  "detectedType": "landing|corporate|ecommerce|webapp|social|game|marketplace|mobile|telegram|crm|api|custom — реальный тип проекта ПО ТЗ (соблюдай правила классификации из системного промпта)",
  "detectedComplexity": "простой|средний|сложный|enterprise",
  "breakdown": [
    {"category": "название самостоятельного модуля или этапа из ТЗ", "hours": число базовых часов}
  ],
  "recommendations": [
    "3-5 практических советов заказчику о границах MVP, расходах после запуска, этапах запуска и приемке"
  ]
}`;

  let pricingResult = '';
  let lastError: Error | null = null;

  // Выбираем промпт: если ТЗ большое — короткий промпт
  const totalChars = description.length + projectContext.length + (clarificationsText?.length || 0);
  const systemPrompt = selectSystemPrompt(totalChars);

  console.log(`[Pricing] Total context: ${totalChars} chars, using ${systemPrompt === SYSTEM_PROMPT_SHORT ? 'SHORT' : 'FULL'} prompt`);

  try {
    pricingResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: pricingPrompt }
    ], 6000);
  } catch (error) {
    lastError = error as Error;
    console.error('Pricing call failed:', error);
  }

  if (!pricingResult) {
    console.warn('[Pricing] AI unavailable, returning deterministic fallback estimate.');
    return NextResponse.json(fallbackPricing(body, description));
  }

  const jsonMatch = pricingResult.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Pricing JSON parse failed. Raw response:', pricingResult.slice(0, 500));
    return NextResponse.json(fallbackPricing(body, description));
  }

  let modelEstimate: ModelEstimate;
  try {
    modelEstimate = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Pricing JSON.parse failed:', e, 'Extracted:', jsonMatch[0].slice(0, 300));
    return NextResponse.json(fallbackPricing(body, description));
  }

  const estimate: EstimateResponse = normalizeEstimate({
    modelEstimate,
    projectType: body.projectType,
    description,
    clarifications: body.clarifications,
    designNeeded: body.designNeeded,
    urgentDeadline: body.urgentDeadline,
  });

  if (estimate.guardrailsApplied.length > 0) {
    console.warn('[Estimate guardrails]', estimate.guardrailsApplied.join(' '));
  }

  return NextResponse.json(estimate);
}

// ══════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY && !NVIDIA_API_KEY) {
      return NextResponse.json(
        { error: 'API ключ не настроен на сервере' },
        { status: 500 }
      );
    }

    const body: EstimateRequest = await request.json();
    const phase = body.phase || 'analyze';
    const rawDesc = body.description || '';

    if (phase === 'analyze') {
      return await handleAnalyzePhase(body, rawDesc);
    } else {
      return await handlePricingPhase(body, rawDesc);
    }
  } catch (error) {
    console.error('Estimate error:', error);
    return NextResponse.json(
      { error: 'Ошибка обработки запроса' },
      { status: 500 }
    );
  }
}
