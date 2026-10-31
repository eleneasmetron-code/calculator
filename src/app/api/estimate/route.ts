import { NextRequest, NextResponse } from 'next/server';
import {
  classifyTypeFromText,
  getEstimationGuardrails,
  normalizeDetectedType,
  normalizeEstimate,
  type Complexity,
  type ModelEstimate,
} from '@/lib/estimation';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const MODEL = 'openai/gpt-oss-20b';
const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

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
  // ── Итог ────────────────────────────────────────────────────────────
  priceMin: number;
  priceMax: number;
  daysMin: number;
  daysMax: number;
  detectedComplexity?: string;
  detectedType?: string;
  estimationBasis: string;
  guardrailsApplied: string[];
  excludedFromPrice: string[];
  recommendations: string[];
  approximate?: boolean;

  // ── Из чего сложилась цена ──────────────────────────────────────────
  modulesPrice: number;
  techReserve: number;
  urgencySurcharge: number;
  complexityFactor: number;
  volumeFactor: number;
  hourlyRate: number;
  modulesCount: number;
  scopeSource: string;
  floorApplied: boolean;
  scopeFloorApplied: number;
  developmentDays: number;
  bufferDays: number;
  breakdown: {
    category: string;
    hours: number;
    price?: number;
    source?: string;
  }[];
  comparable: {
    label: string;
    priceMin: number;
    priceMax: number;
    daysMin: number;
    daysMax: number;
  };
  studioComparison: {
    priceMin: number;
    priceMax: number;
    daysMin: number;
    daysMax: number;
  };

  // ── Справочно ───────────────────────────────────────────────────────
  baseHours: number;
  testingHours: number;
  testingPercent: number;
  totalHours: number;
  productiveHoursPerDay: number;
  days: number;
  dailyRate: number;
  operationalExpenses: number;
}

const SYSTEM_PROMPT_SHORT = `Ты — оценщик объёма работ для ОДНОГО разработчика, который собирает рабочий продукт вместе с AI-агентами и готовыми библиотеками (вайб-кодер). Быстрее и дешевле студии, но это полноценная разработка.

ГЛАВНОЕ ПРАВИЛО: тип проекта, выбранный в форме, — формальность для интерфейса. Реальный объём работ определяют ТОЛЬКО описание проекта и ТЗ. Не подстраивай оценку под кнопку.

Объём работ — это ПЕРЕЧЕНЬ МОДУЛЕЙ, а не часы. Часы и стоимость считает сервер.

Классификация типа (detectedType) — строго одно из:
landing, corporate, ecommerce, webapp, social, game, marketplace, mobile, telegram, crm, api, custom.
- social — только настоящая соцсеть: лента, подписки, профили, сообщения, сообщества.
- «Образовательная платформа», «платформа услуг», «маркетплейс» — это НЕ social.

Что НЕ входит в разработку (подключение хостинга, домена, онлайн-оплат, SMS, карт, OCR, внешних API и прочих платных сервисов): перечисли это в excludedFromPrice, но НЕ включай в модули.

Правила:
1. Источник правды — текст ТЗ и описания. Дополнительные функции формы — подсказки, не дублируй их.
2. Короткое описание известного продукта раскрывай до реальных подсистем, но не выдумывай лишнего.
3. Каждый модуль описывай так, чтобы было понятно, что именно делается.
4. Не добавляй модули «тестирование», «деплой», «документация», «резерв» — их сервер считает сам.
5. Стоимость, ставку, сроки и сравнение со студией НЕ указывай.
6. Вопросы задавай только те, ответы на которые реально меняют объём работ.
7. Отвечай только валидным JSON на русском языке.`;

const SYSTEM_PROMPT = `${SYSTEM_PROMPT_SHORT}

При определении модулей держи в голове полный цикл рабочего результата: уточнение поведения и крайних случаев, схема данных и разграничение прав, интерфейс, серверная логика, состояния загрузки и ошибок, безопасность и журналирование, тестовые данные и проверка сценариев, деплой и передача проекта. Это не отдельные модули, а неотъемлемая часть каждого модуля — просто учитывай это, чтобы не занижать объём.

Готовый UI-кит, SDK или AI-генерация ускоряют типовой код, но их нужно адаптировать, связать с данными, проверить и стабилизировать.

Если ТЗ описывает маркетплейс, раскрывай контуры покупателя, продавца и оператора. Если описывает соцсеть — раскрывай ленту, профили, подписки, сообщения, сообщества, модерацию.`;

function selectSystemPrompt(totalChars: number): string {
  return totalChars > 100000 ? SYSTEM_PROMPT_SHORT : SYSTEM_PROMPT;
}

// ══════════════════════════════════════
// ══════════════════════════════════════
// API CALL — NVIDIA
// ══════════════════════════════════════

async function callAI(messages: { role: string; content: string }[], maxTokens: number): Promise<string> {
  if (!NVIDIA_API_KEY) {
    throw new Error('API ключи не настроены');
  }

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);

  console.log(`[AI] Trying NVIDIA ${MODEL}, total chars: ${totalChars}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.5,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`NVIDIA API error: ${response.status} — ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('NVIDIA: модель вернула пустой ответ');
    }

    console.log(`[AI] NVIDIA ${MODEL} success!`);
    return content;
  } catch (err) {
    const error = err as Error;
    console.error('[AI] NVIDIA error:', error.message);
    throw new Error(`Сервис временно недоступен: ${error.message}`);
  }
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

const FEATURE_MODULE_HINTS: Array<{ pattern: RegExp; module: string }> = [
  { pattern: /(авторизац|личный кабинет|логин|регистрац|профиль)/i, module: 'Регистрация, вход, профили и личный кабинет' },
  { pattern: /(оплат|платеж|подписк|эквайринг)/i, module: 'Оплата, подписки и выплаты' },
  { pattern: /(интеграц|crm|1с|erp|склад)/i, module: 'Внешние интеграции и обмен данными' },
  { pattern: /(email|sms|уведомлен|push|рассылк|напомин)/i, module: 'Уведомления: внутренние, email, push, Telegram' },
  { pattern: /(админ|модерац|роли)/i, module: 'Админ-панель, модерация и роли' },
  { pattern: /(поиск|фильтр|каталог|сортировк)/i, module: 'Поиск, фильтры и каталог' },
  { pattern: /(загрузк\w*\s+файл|фото|медиа|галере|видео)/i, module: 'Публикация и управление контентом (фото, видео, файлы)' },
  { pattern: /(мультиязыч|локализац|перевод)/i, module: 'Мультиязычность и локализация' },
  { pattern: /(аналитик|график|отчет|отчёт|дашборд|метрик)/i, module: 'Аналитика, графики и отчёты' },
  { pattern: /(экспорт|импорт|pdf|excel|csv)/i, module: 'Экспорт и импорт данных (PDF, Excel, CSV)' },
  { pattern: /(карт|гео|маршрут)/i, module: 'Геосервисы, карты и маршруты' },
  { pattern: /(ии|ai|нейросет|gpt|llm|ассистент|рекомендац)/i, module: 'AI-функции: подбор, ассистент, рекомендации' },
  { pattern: /(бронирован|расписани|календар|запис|событи)/i, module: 'События, бронирование и расписание' },
  { pattern: /(достижен|балл|уровн|наград|геймификац)/i, module: 'Достижения, уровни и игровые механики' },
];

/** Модули, которые каталог сервера уже знает по тексту ТЗ. Показываем их ИИ,
 *  чтобы он не дублировал работу и не выдумывал лишнее, а добавлял только
 *  то, чего в списке нет. */
function knownModulesFromText(description: string): string[] {
  const text = description.toLowerCase();
  const found: string[] = [];
  const catalog: Array<{ pattern: RegExp; module: string }> = [
    { pattern: /дизайн|ui|ux|макет|адаптив/, module: 'Дизайн: UI/UX, дизайн-система, адаптивность' },
    { pattern: /регистрац|авторизац|логин|парол|вход/, module: 'Регистрация, вход и безопасность' },
    { pattern: /профил|аккаунт|кабинет|аватар/, module: 'Профили пользователей и личный кабинет' },
    { pattern: /лент|фид|подписк|подписчик|рекомендац/, module: 'Лента, подписки и алгоритм показа' },
    { pattern: /публикац|пост|контент|фото|галере|загрузк/, module: 'Публикация и управление контентом' },
    { pattern: /коммент|реакц|лайк|сохранен/, module: 'Комментарии, реакции и сохранения' },
    { pattern: /сообщен|мессенджер|(?<![а-яa-z])чат(?!-?бот)|переписк/, module: 'Личные сообщения и чаты' },
    { pattern: /сообществ|групп|форум|клуб/, module: 'Сообщества, группы и форумы' },
    { pattern: /уведомлен|email|push|рассылк|напомин/, module: 'Уведомления: внутренние, email, push, Telegram' },
    { pattern: /поиск|фильтр|каталог|сортировк|подбор/, module: 'Поиск, фильтры и каталог' },
    { pattern: /мероприят|событи|бронирован|расписани|календар/, module: 'События, бронирование и расписание' },
    { pattern: /админ|модерац|жалоб|роли|оператор/, module: 'Админ-панель, модерация и роли' },
    { pattern: /бэкенд|backend|\bapi\b|сервер|база данн|\bбд\b|бизнес[-\s]?логик/, module: 'Backend, API, база данных и бизнес-логика' },
    { pattern: /мобильн|android|ios|flutter|pwa/, module: 'Мобильное приложение (Android/iOS)' },
    { pattern: /интеграц|внешн\w*\s+сервис|webhook|вебхук|\bsdk\b/, module: 'Внешние интеграции и обмен данными' },
    { pattern: /высок\w*\s+нагруз|нагрузочн|масштабир|мониторинг|отказоустойчив/, module: 'Нагрузка, кэширование, мониторинг и отказоустойчивость' },
    { pattern: /ии[-\s]?(ассистент|поиск|подбор)|\bии\b|нейросет|gpt|llm|ассистент/, module: 'AI-функции: подбор, ассистент, рекомендации' },
    { pattern: /видео|video|стрим|трансляц|reels|laps|shorts/, module: 'Видео, стриминг и короткие видео' },
    { pattern: /онлайн[-\s]?оплат|платежн\w*\s+(шлюз|систем)|эквайринг|подписк|биллинг/, module: 'Оплата, подписки и выплаты' },
    { pattern: /карт[аыу]\b|геолокац|маршрут|2gis|2гис/, module: 'Геосервисы, карты и маршруты' },
    { pattern: /распознаван|скан\w*\s+чек|qr[-\s]?код|проверк\w*\s+чек/, module: 'Распознавание документов и чеков' },
    { pattern: /аналитик|график|отчет|отчёт|дашборд|метрик|статистик/, module: 'Аналитика, графики и отчёты' },
    { pattern: /отзыв|рейтинг\w*\s+(исполнител|продавц|товар)|оценк\w*\s+(товар|услуг)/, module: 'Отзывы, оценки и рейтинг исполнителей' },
    { pattern: /достижен|ачивк|уровн|очк|лидерборд|геймификац|наград/, module: 'Достижения, уровни и игровые механики' },
    { pattern: /репутац|довери|водительск\w*\s+рейтинг|driver\s*score/, module: 'Репутация, доверие и система жалоб' },
  ];
  for (const entry of catalog) {
    if (entry.pattern.test(text)) found.push(entry.module);
  }
  return found;
}

function modulesFromFeatures(features: string[]): string[] {
  const modules: string[] = [];
  for (const feature of features) {
    const hint = FEATURE_MODULE_HINTS.find(entry => entry.pattern.test(feature));
    const moduleName = hint ? hint.module : feature.trim();
    if (moduleName && !modules.includes(moduleName)) modules.push(moduleName);
  }
  return modules;
}

function buildProjectContext(body: EstimateRequest, description: string, hasFullTZ: boolean, isSummarized?: boolean): string {
  const actualType = description.trim()
    ? 'Определи формат исключительно по описанию и ТЗ.'
    : getTypeLabel(body.projectType, body.projectTypeCustom);
  const formFeatures = [...(body.features || []), ...(body.customFeatures || [])];
  const guardrails = getEstimationGuardrails({
    projectType: body.projectType,
    description,
    clarifications: body.clarifications,
    designNeeded: body.designNeeded,
  });
  const knownModules = knownModulesFromText(description);
  const featureModules = modulesFromFeatures(formFeatures);

  const tzLabel = isSummarized
    ? '⚠️ ТЗ из нескольких файлов — ниже структурированный анализ каждого файла. Учитывай ВСЕ модули из ВСЕХ файлов!'
    : hasFullTZ
      ? '⚠️ Приложено ПОЛНОЕ ТЗ — анализируй ВСЕ разделы и модули из него.'
      : '';

  return `${tzLabel}

КОНТЕКСТ:
- Кнопка формы (формальность, НЕ влияет на объём): ${actualType}
- Тип, определённый сервером по тексту: ${guardrails.profile.label}
- Технологии: ${body.techStack.length > 0 ? body.techStack.join(', ') : 'на усмотрение разработчика'}
- Дизайн (UI/UX): ${body.designNeeded ? 'нужен отдельный дизайн' : 'не заявлен отдельно'}
- Срочность: ${body.urgentDeadline ? 'срочный проект, объём работ НЕ сокращается' : 'стандартные сроки'}

МОДУЛИ, КОТОРЫЕ СЕРВЕР УЖЕ НАШЁЛ В ТЕКСТЕ (не дублируй их):
${knownModules.length > 0 ? knownModules.map(module => `  • ${module}`).join('\n') : '  — не найдено'}

ФУНКЦИИ ИЗ ФОРМЫ (интерпретация сервером):
${featureModules.length > 0 ? featureModules.map(module => `  • ${module}`).join('\n') : '  — не выбраны'}

ОПИСАНИЕ/ТЗ:
${description}`;
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

  const analysisPrompt = `Проанализируй проект и задай ТОЛЬКО те уточняющие вопросы, которые реально меняют объём работ и стоимость.

${projectContext}

ЗАДАЧА:
1. Определи реальный тип проекта по ТЗ: landing, corporate, ecommerce, webapp, social, game, marketplace, mobile, telegram, crm, api, custom. social — только настоящая соцсеть (лента, подписки, профили, сообщения, сообщества); «образовательная платформа» и прочие «платформы» — это custom/webapp.
2. Определи сложность: простой | средний | сложный | enterprise.
3. Найди в описании НЕЯСНОСТИ, которые заметно меняют объём работ.
4. Задай вопросы по этим неясностям.

ПРАВИЛА ДЛЯ ВОПРОСОВ:
- Вопросы нужны ТОЛЬКО для точности оценки. Если из описания всё понятно — верни ПУСТОЙ массив questions.
- Хорошее ТЗ (>5000 символов) → 0-2 вопроса, только по реальным пробелам.
- Среднее описание (500-5000 символов) → 2-5 вопросов.
- Короткое описание (<500 символов) → 3-7 вопросов по главному: что за продукт, кто пользователи, какие ключевые сценарии.
- НЕ спрашивай то, что уже написано в описании или ТЗ.
- НЕ спрашивай про тестирование, деплой, документацию, сроки и бюджет — это не входит в зону заказчика.
- Спрашивай про объём: количество ролей, типы контента, каналы уведомлений, набор разделов, необходимость мобильного приложения, объём данных, нужна ли модерация.
- Каждый вопрос — 2-4 конкретных варианта ответа.

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

  // Тип определяет сервер, ИИ только предлагает вариант.
  let detectedType = normalizeDetectedType(parsed.detectedType)
    || classifyTypeFromText(description, description.trim() ? 'custom' : body.projectType);
  if (detectedType === 'social' && !/(лент|подписк|подписчик|сообществ|профил\w*\s+пользовател|личн\w*\s+сообщен|мессенджер|друз)/i.test(description)) {
    detectedType = 'custom';
  }

  return NextResponse.json({
    questions: (parsed.questions || []).slice(0, 8),
    detectedComplexity: modelComplexity,
    detectedType,
    analysis: parsed.analysis || '',
    ...(isSummarized ? { filesAnalyzed: splitFiles(rawDesc).length } : {}),
  });
}

// Запасной расчёт: если ИИ недоступен или вернул ерунду, считаем объём
// детерминированно по тексту ТЗ. Заказчик всегда получает число.
function fallbackPricing(
  body: EstimateRequest,
  description: string,
): EstimateResponse {
  const estimate = normalizeEstimate({
    modelEstimate: { recommendations: [] },
    projectType: body.projectType,
    description,
    clarifications: body.clarifications,
    designNeeded: body.designNeeded,
    urgentDeadline: body.urgentDeadline,
    features: body.features,
    customFeatures: body.customFeatures,
    techStack: body.techStack,
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

  // Build clarifications text from user answers
  let clarificationsText = '';
  if (body.clarifications && Object.keys(body.clarifications).length > 0) {
    clarificationsText = '\n\nУТОЧНЕНИЯ ОТ КЛИЕНТА:\n' +
      Object.entries(body.clarifications)
        .map(([q, a]) => `• ${q}: ${a}`)
        .join('\n');
  }

  const pricingPrompt = `Определи состав работ по проекту: перечисли самостоятельные модули, которые реально нужно сделать.

${projectContext}${clarificationsText}

ПРАВИЛА:
- Кнопка типа проекта — формальность. Реальный объём определяют ТОЛЬКО описание и ТЗ.
- НЕ дублируй модули, которые сервер уже нашёл в тексте (список выше).
- Добавляй в modules ТОЛЬКО те подсистемы, которых нет в списке сервера, но они есть в ТЗ. Если таких нет — верни пустой массив.
- Каждый модуль — самодостаточная часть продукта (например: «Личные сообщения с групповыми чатами»), а не технический этап.
- НЕ включай: тестирование, отладку, деплой, документацию, аналитику требований, резервы, сопровождение.
- НЕ включай подключение хостинга, домена, онлайн-оплат, SMS, карт, OCR и прочих платных сервисов — они идут в excludedFromPrice.
- Учитывай уточнения клиента и все файлы ТЗ.
- Объём работ не сокращай из-за того, что код пишет AI: настройка, связывание, крайние случаи и проверка остаются.
${isSummarized ? '- ТЗ проанализировано пофайлово: собери требования из всех файлов.\n' : ''}
- recommendations: 2-3 коротких практических совета заказчику (границы первой версии, что подключить отдельно, этапы запуска).

Ответь ТОЛЬКО валидным JSON на русском языке:
{
  "detectedType": "landing|corporate|ecommerce|webapp|social|game|marketplace|mobile|telegram|crm|api|custom",
  "detectedComplexity": "простой|средний|сложный|enterprise",
  "modules": [
    {"name": "название подсистемы из ТЗ", "size": "small|medium|large"}
  ],
  "excludedFromPrice": [
    "какие внешние сервисы нужно подключать отдельно (например: онлайн-оплата)"
  ],
  "recommendations": [
    "совет заказчику"
  ]
}`;

  let pricingResult = '';

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
    features: body.features,
    customFeatures: body.customFeatures,
    techStack: body.techStack,
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
    if (!NVIDIA_API_KEY) {
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
