// Калькулятор стоимости IT-проектов.
//
// Модель ценообразования (детерминированная: модули из текста ТЗ):
//   - Модули определяются ИЗ ТЕКСТА ТЗ по ключевым словам (MODULE_KEYWORDS);
//     одинаковый текст = одинаковые модули = одна цена (AI НЕ влияет на цену);
//   - каждый модуль оценивается по ДЕШЁВЫМ фиксированным ставкам
//     (MODULE_PRICE_RUB) — разработчик работает с AI и готовыми библиотеками;
//   - итоговая цена зажимается в резюме-коридор типа проекта
//     (минимум по типу, потолок НЕ применяется — ТЗ определяет цену);
//   - обязательная надбавка за инструменты/сторонние сервисы: TOOL_FEE_RUB = 10000 ₽;
//   - классификация типа — ПО ТЗ (detectedType от ИИ), а не по кнопке формы;
//     «платформа»/«образовательная платформа» НЕ является соцсетью.

export const DAILY_RATE_RUB = 5000;
export const TOOL_FEE_RUB = 10000;

// ── Гибридное ценообразование: модули из ТЗ + коридор по типу ──────────
// ИИ разбивает ТЗ на модули; каждый модуль оценивается по ДЕШЁВЫМ
// фиксированным ставкам (разработчик работает с AI/готовыми библиотеками,
// не как студия). Итог зажимается в резюме-коридор типа проекта — это
// исключает завышение «как у студий» и удерживает оценку в реалистичных рамках.
export type ModuleType =
  | 'telegram_bot' | 'landing' | 'admin' | 'mobile' | 'backend'
  | 'db' | 'frontend' | 'integration' | 'other';
export type ModuleSize = 'small' | 'medium' | 'large';

// Дешёвые базовые цены модуля, ₽ (для соло-разработчика с AI):
// Ставки занижены относительно студий — разработчик работает с AI
// и готовыми библиотеками, не набирает команду.
const MODULE_PRICE_RUB: Record<ModuleType, Record<ModuleSize, number>> = {
  telegram_bot: { small: 11_000, medium: 20_000, large: 33_000 },
  landing:      { small: 11_000, medium: 20_000, large: 33_000 },
  admin:        { small: 16_000, medium: 29_000, large: 50_000 },
  mobile:       { small: 24_000, medium: 45_000, large: 75_000 },
  backend:      { small: 21_000, medium: 40_000, large: 70_000 },
  db:           { small: 12_000, medium: 23_000, large: 40_000 },
  frontend:     { small: 16_000, medium: 29_000, large: 50_000 },
  integration:  { small:  9_000, medium: 18_000, large: 30_000 },
  other:        { small: 14_000, medium: 26_000, large: 48_000 },
};

// Рабочие дни на модуль по размеру (снижены для соло-разработчика с AI):
const MODULE_DAYS: Record<ModuleSize, number> = { small: 0.5, medium: 1, large: 1.15 };

const MODULE_KEYWORDS: Array<{ type: ModuleType; patterns: RegExp }> = [
  { type: 'telegram_bot', patterns: /(телеграм|telegram|бот|bot\b|чат[-\s]?бот)/i },
  { type: 'landing', patterns: /(лендинг|визитк|landing|посадочн)/i },
  { type: 'admin', patterns: /(админ|admin|панель управлени|кабинет оператор|back[- ]?office)/i },
  { type: 'mobile', patterns: /(мобильн|приложен|мобил|android|ios|swift|flutter|react native|kotlin)/i },
  { type: 'db', patterns: /(база данн|бд|database|postgres|миграц|хранилищ|sql)/i },
  { type: 'backend', patterns: /(бэкенд|backend|api|сервер|server|микросервис|graphql|\brest\b)/i },
  { type: 'frontend', patterns: /(фронт|frontend|интерфейс|\bui\b|\bux\b|дизайн|верстк|спа|react|vue|next)/i },
  { type: 'integration', patterns: /(интеграц|интегрир|внешн\w*\s+сервис|webhook|\bsdk\b|платёжн\w*\s+шлюз|\bsms\b|email рассыл|уведомл)/i },
];

function resolveModuleType(category: string): ModuleType {
  for (const entry of MODULE_KEYWORDS) {
    if (entry.patterns.test(category)) return entry.type;
  }
  return 'other';
}

function sizeFromHours(hours: number): ModuleSize {
  if (hours <= 8) return 'small';
  if (hours <= 20) return 'medium';
  return 'large';
}

// Детерминированные названия модулей для отображения:
const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  telegram_bot: 'Telegram-бот',
  landing: 'Лендинг (кастомный дизайн, адаптивность)',
  admin: 'Админ-панель (управление пользователями, контентом, аналитика)',
  mobile: 'Мобильное приложение (каталог, профиль, уведомления)',
  backend: 'Backend API и бизнес-логика',
  db: 'База данных и схема',
  frontend: 'Frontend (SPA/интерфейс, компоненты)',
  integration: 'Интеграции (платежи, email/SMS, webhook)',
  other: 'Дополнительный функционал',
};

// ── Детерминированный парсер модулей из текста ТЗ ─────────────────────
// Сканирует текст ТЗ на наличие ключевых слов MODULE_KEYWORDS и возвращает
// список модулей с фиксированными часами. Одинаковый текст = одинаковые
// модули = одна цена. AI НЕ используется для определения цены.
function detectModulesFromText(text: string): BreakdownItem[] {
  const normalized = normalizeText(text);
  const modules: BreakdownItem[] = [];
  const seen = new Set<ModuleType>();

  // Добавляем аналитику всегда
  modules.push({ category: 'Аналитика требований и архитектура', hours: 8 });

  // Сканируем текст на наличие ключевых слов каждого типа модуля
  for (const entry of MODULE_KEYWORDS) {
    if (seen.has(entry.type)) continue;
    const matches = normalized.match(new RegExp(entry.patterns.source, 'gi'));
    if (matches && matches.length > 0) {
      seen.add(entry.type);
      // Размер модуля определяется длиной ТЗ (чем подробнее ТЗ — тем больше модуль)
      const size: ModuleSize = normalized.length > 2000 ? 'large' : normalized.length > 500 ? 'medium' : 'small';
      modules.push({
        category: MODULE_TYPE_LABELS[entry.type],
        hours: MODULE_BASE_HOURS[entry.type][size],
      });
    }
  }

  // Дополнительные модули на основе контекстных ключевых слов
  if (!seen.has('backend') && /(сервер|хостинг|деплой|docker|ci[\s\/-]?cd)/i.test(normalized)) {
    seen.add('backend');
    const size: ModuleSize = normalized.length > 2000 ? 'large' : normalized.length > 500 ? 'medium' : 'small';
    modules.push({ category: MODULE_TYPE_LABELS.backend, hours: MODULE_BASE_HOURS.backend[size] });
  }
  if (!seen.has('db') && /(пользовател|аккаунт|авторизац|профил|роль)/i.test(normalized) && !seen.has('admin')) {
    seen.add('admin');
    const size: ModuleSize = normalized.length > 2000 ? 'large' : normalized.length > 500 ? 'medium' : 'small';
    modules.push({ category: MODULE_TYPE_LABELS.admin, hours: MODULE_BASE_HOURS.admin[size] });
  }
  if (!seen.has('frontend') && /(интерфейс|экран|страниц|вид|экшен|кнопк|меню)/i.test(normalized) && !seen.has('landing')) {
    seen.add('frontend');
    const size: ModuleSize = normalized.length > 2000 ? 'large' : normalized.length > 500 ? 'medium' : 'small';
    modules.push({ category: MODULE_TYPE_LABELS.frontend, hours: MODULE_BASE_HOURS.frontend[size] });
  }

  return modules;
}

// Базовые часы на модуль по размеру (детерминировано, не зависит от AI):
const MODULE_BASE_HOURS: Record<ModuleType, Record<ModuleSize, number>> = {
  telegram_bot: { small: 15, medium: 25, large: 40 },
  landing:      { small: 12, medium: 20, large: 32 },
  admin:        { small: 20, medium: 35, large: 60 },
  mobile:       { small: 30, medium: 55, large: 90 },
  backend:      { small: 25, medium: 50, large: 85 },
  db:           { small: 12, medium: 25, large: 45 },
  frontend:     { small: 20, medium: 35, large: 60 },
  integration:  { small: 10, medium: 20, large: 35 },
  other:        { small: 15, medium: 30, large: 50 },
};

export type Complexity = 'простой' | 'средний' | 'сложный' | 'enterprise';

export interface BreakdownItem {
  category: string;
  hours: number;
}

export interface ModelEstimate {
  detectedComplexity?: string;
  detectedType?: string;
  breakdown?: BreakdownItem[];
  recommendations?: string[];
}

export interface EstimateResult {
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
  detectedComplexity: Complexity;
  estimationBasis: string;
  guardrailsApplied: string[];
  breakdown: BreakdownItem[];
  studioComparison: {
    priceMin: number;
    priceMax: number;
    daysMin: number;
    daysMax: number;
  };
  recommendations: string[];
  approximate?: boolean;
}

interface ProjectProfile {
  label: string;
  // Резюме-калибровка: стоимость (₽) и срок (рабочие дни) берутся напрямую из резюме.
  minPriceRub: number;
  maxPriceRub: number;
  minWorkingDays: number;
  maxWorkingDays: number;
  minBaseHours: number;
  cloneMinBaseHours?: number;
  cloneMinWorkingDays?: number;
  complexityFloor: Complexity;
  cloneComplexityFloor?: Complexity;
  typicalModules: BreakdownItem[];
}

interface CloneReference {
  label: string;
  type: string;
}

export interface EstimationGuardrails {
  effectiveType: string;
  profile: ProjectProfile;
  knownClone: CloneReference | null;
  isMvp: boolean;
  isFullScope: boolean;
  isHighLoad: boolean;
  requiredBaseHours: number;
  minimumWorkingDays: number;
  maximumWorkingDays: number;
  complexityFloor: Complexity;
  reasons: string[];
}

interface NormalizeEstimateInput {
  modelEstimate: ModelEstimate;
  projectType: string;
  description: string;
  clarifications?: Record<string, string>;
  designNeeded: boolean;
  urgentDeadline: boolean;
}

const PRODUCTIVE_HOURS_PER_DAY = 6;

const COMPLEXITY_ORDER: Complexity[] = [
  'простой',
  'средний',
  'сложный',
  'enterprise',
];

// Единая ставка 5000 ₽/день для всех уровней. Поля оставлены для совместимости
// (operationalExpenses = 0, так как надбавка за инструменты вынесена в TOOL_FEE_RUB).
const COMPLEXITY_SETTINGS: Record<Complexity, {
  dailyRate: number;
  testingPercent: number;
  operationalExpenses: number;
  rangeFactor: number;
  studioPriceMinFactor: number;
  studioPriceMaxFactor: number;
  studioDaysMinFactor: number;
  studioDaysMaxFactor: number;
}> = {
  'простой': {
    dailyRate: DAILY_RATE_RUB,
    testingPercent: 0.15,
    operationalExpenses: 0,
    rangeFactor: 1.25,
    studioPriceMinFactor: 2.5,
    studioPriceMaxFactor: 4,
    studioDaysMinFactor: 1.4,
    studioDaysMaxFactor: 2,
  },
  'средний': {
    dailyRate: DAILY_RATE_RUB,
    testingPercent: 0.18,
    operationalExpenses: 0,
    rangeFactor: 1.3,
    studioPriceMinFactor: 3,
    studioPriceMaxFactor: 4.5,
    studioDaysMinFactor: 1.5,
    studioDaysMaxFactor: 2.2,
  },
  'сложный': {
    dailyRate: DAILY_RATE_RUB,
    testingPercent: 0.22,
    operationalExpenses: 0,
    rangeFactor: 1.4,
    studioPriceMinFactor: 3.5,
    studioPriceMaxFactor: 5.5,
    studioDaysMinFactor: 1.6,
    studioDaysMaxFactor: 2.5,
  },
  enterprise: {
    dailyRate: DAILY_RATE_RUB,
    testingPercent: 0.28,
    operationalExpenses: 0,
    rangeFactor: 1.5,
    studioPriceMinFactor: 4,
    studioPriceMaxFactor: 7,
    studioDaysMinFactor: 1.8,
    studioDaysMaxFactor: 2.8,
  },
};

// Калибровка по резюме (https://vibeses.vercel.app/):
//   - срок (рабочие дни) — прямо из резюме для каждого проекта;
//   - стоимость (₽) — из резюме-диапазона $ переведена в ₽ (≈ $1 → 66–80 ₽,
//     для NOMAD $3 000–$5 000 = 200 000–400 000 ₽, как согласовано).
//   landing     STEEL       $800–1500     →  56–105k    · 2–3 дня
//   corporate   (нет в ТЗ)                 →  100–200k   · 3–7 дней
//   ecommerce   (нет в ТЗ)                 →  200–420k   · 5–12 дней
//   webapp      CODEGRAPH/…  $3–5k        →  200–350k   · 3–7 дней
//   social      SOCWORLD     $13–23k      →  867k–1.84M · 15–30 дней
//   game        (нет в ТЗ)                 →  700k–1.15M · 10–20 дней
//   marketplace TASKBRIDGE   $2–3k        →  140–210k   · 5–7 дней
//   mobile      (нет в ТЗ)                 →  200–400k   · 5–12 дней
//   telegram    BOOKING      $2–3k        →  140–210k   · 2–5 дней
//   crm         TONUS        $2.5–4.5k    →  175–315k   · 3–5 дней
//   api         CODESHIELD    $4–6k       →  280–420k   · 2–5 дней
//   custom      NOMAD        $3–5k        →  200–400k   · 7–15 дней (указано заказчиком)
export const PROJECT_PROFILES: Record<string, ProjectProfile> = {
  landing: {
    label: 'Лендинг / Визитка',
    minPriceRub: 56_000,
    maxPriceRub: 105_000,
    minWorkingDays: 2,
    maxWorkingDays: 3,
    minBaseHours: 18,
    complexityFloor: 'простой',
    typicalModules: [
      { category: 'Аналитика, структура и подготовка контента', hours: 2 },
      { category: 'UI-концепция и адаптивный дизайн', hours: 4 },
      { category: 'Адаптивная верстка и интерактивность', hours: 6 },
      { category: 'Формы и интеграции', hours: 2 },
      { category: 'SEO, аналитика и доступность', hours: 2 },
      { category: 'Деплой и передача проекта', hours: 2 },
    ],
  },
  corporate: {
    label: 'Корпоративный сайт',
    minPriceRub: 100_000,
    maxPriceRub: 200_000,
    minWorkingDays: 3,
    maxWorkingDays: 7,
    minBaseHours: 45,
    complexityFloor: 'средний',
    typicalModules: [
      { category: 'Аналитика, структура и архитектура сайта', hours: 4 },
      { category: 'Дизайн-система и адаптивные макеты', hours: 8 },
      { category: 'Главная страница и базовые шаблоны', hours: 10 },
      { category: 'Внутренние страницы и контентные блоки', hours: 8 },
      { category: 'CMS, блог или новости', hours: 6 },
      { category: 'Формы и внешние интеграции', hours: 3 },
      { category: 'SEO, аналитика и доступность', hours: 3 },
      { category: 'Деплой, мониторинг и документация', hours: 3 },
    ],
  },
  ecommerce: {
    label: 'Интернет-магазин',
    minPriceRub: 200_000,
    maxPriceRub: 420_000,
    minWorkingDays: 5,
    maxWorkingDays: 12,
    minBaseHours: 120,
    complexityFloor: 'сложный',
    typicalModules: [
      { category: 'Архитектура, модель данных и окружения', hours: 10 },
      { category: 'UI/UX и адаптивный интерфейс', hours: 14 },
      { category: 'Каталог, категории, поиск и фильтры', hours: 16 },
      { category: 'Карточка товара, варианты и остатки', hours: 10 },
      { category: 'Корзина, промокоды и оформление заказа', hours: 12 },
      { category: 'Оплата, чеки и обработка ошибок', hours: 10 },
      { category: 'Авторизация и личный кабинет', hours: 10 },
      { category: 'Заказы, статусы, возвраты и уведомления', hours: 12 },
      { category: 'Админ-панель, товары и управление заказами', hours: 14 },
      { category: 'SEO, аналитика, деплой и мониторинг', hours: 12 },
    ],
  },
  webapp: {
    label: 'Веб-приложение (SaaS)',
    minPriceRub: 200_000,
    maxPriceRub: 350_000,
    minWorkingDays: 3,
    maxWorkingDays: 7,
    minBaseHours: 140,
    cloneMinBaseHours: 220,
    cloneMinWorkingDays: 7,
    complexityFloor: 'сложный',
    cloneComplexityFloor: 'enterprise',
    typicalModules: [
      { category: 'Аналитика требований и архитектура', hours: 12 },
      { category: 'Дизайн-система и основные пользовательские потоки', hours: 16 },
      { category: 'Авторизация, роли и управление доступом', hours: 12 },
      { category: 'Основной продуктовый функционал', hours: 30 },
      { category: 'Backend API и модель данных', hours: 18 },
      { category: 'Рабочие кабинеты и дашборды', hours: 14 },
      { category: 'Подписки, платежи и биллинг', hours: 10 },
      { category: 'Админ-панель и служебные инструменты', hours: 10 },
      { category: 'Уведомления и внешние интеграции', hours: 8 },
      { category: 'Безопасность, мониторинг, CI/CD и документация', hours: 10 },
    ],
  },
  social: {
    label: 'Социальная сеть / Платформа',
    minPriceRub: 867_000,
    maxPriceRub: 1_840_000,
    minWorkingDays: 15,
    maxWorkingDays: 30,
    minBaseHours: 220,
    cloneMinBaseHours: 300,
    cloneMinWorkingDays: 30,
    complexityFloor: 'enterprise',
    cloneComplexityFloor: 'enterprise',
    typicalModules: [
      { category: 'Архитектура, модель данных и окружения', hours: 16 },
      { category: 'UI/UX и адаптивный интерфейс', hours: 18 },
      { category: 'Авторизация, профили и приватность', hours: 20 },
      { category: 'Публикация и управление контентом', hours: 16 },
      { category: 'Лента, подписки и социальный граф', hours: 18 },
      { category: 'Реакции, комментарии и сохранения', hours: 18 },
      { category: 'Чат и real-time взаимодействие', hours: 24 },
      { category: 'Поиск, рекомендации и обнаружение контента', hours: 18 },
      { category: 'Уведомления и email-сценарии', hours: 14 },
      { category: 'Модерация, жалобы и безопасность', hours: 18 },
      { category: 'Админ-панель, аналитика и поддержка', hours: 20 },
      { category: 'Нагрузка, мониторинг, CI/CD и запуск', hours: 20 },
    ],
  },
  game: {
    label: 'Игровая платформа',
    minPriceRub: 700_000,
    maxPriceRub: 1_155_000,
    minWorkingDays: 10,
    maxWorkingDays: 20,
    minBaseHours: 220,
    cloneMinBaseHours: 320,
    cloneMinWorkingDays: 20,
    complexityFloor: 'сложный',
    cloneComplexityFloor: 'enterprise',
    typicalModules: [
      { category: 'Игровая архитектура и прототип механик', hours: 24 },
      { category: 'Основной игровой цикл и состояния', hours: 36 },
      { category: 'Интерфейс, HUD и адаптивность', hours: 18 },
      { category: 'Контент, уровни и игровые данные', hours: 28 },
      { category: 'Профили, прогресс и достижения', hours: 18 },
      { category: 'Мультиплеер и синхронизация', hours: 30 },
      { category: 'Покупки, экономика и награды', hours: 16 },
      { category: 'Лидерборды, социальные функции и уведомления', hours: 14 },
      { category: 'Админ-панель и управление контентом', hours: 14 },
      { category: 'Оптимизация, мониторинг, CI/CD и запуск', hours: 22 },
    ],
  },
  marketplace: {
    label: 'Маркетплейс',
    minPriceRub: 140_000,
    maxPriceRub: 210_000,
    minWorkingDays: 5,
    maxWorkingDays: 7,
    minBaseHours: 220,
    cloneMinBaseHours: 280,
    cloneMinWorkingDays: 7,
    complexityFloor: 'enterprise',
    cloneComplexityFloor: 'enterprise',
    typicalModules: [
      { category: 'Архитектура, модель данных и окружения', hours: 18 },
      { category: 'UI/UX, дизайн-система и адаптивность', hours: 20 },
      { category: 'Авторизация и кабинет покупателя', hours: 14 },
      { category: 'Регистрация, проверка и кабинет продавца', hours: 16 },
      { category: 'Каталог, товары, варианты и остатки', hours: 22 },
      { category: 'Поиск, фильтры и рекомендации', hours: 18 },
      { category: 'Корзина, промокоды и оформление заказа', hours: 18 },
      { category: 'Платежи, разделение выплат и возвраты', hours: 22 },
      { category: 'Заказы, статусы, возвраты и споры', hours: 20 },
      { category: 'Финансы, отчеты и выплаты продавцам', hours: 18 },
      { category: 'Доставка, склады и логистические статусы', hours: 22 },
      { category: 'Админ-панель, модерация и поддержка', hours: 18 },
      { category: 'Отзывы, чат и уведомления', hours: 14 },
      { category: 'Безопасность, аудит и антифрод', hours: 22 },
      { category: 'Аналитика, нагрузка, мониторинг и запуск', hours: 18 },
    ],
  },
  mobile: {
    label: 'Мобильное приложение',
    minPriceRub: 200_000,
    maxPriceRub: 400_000,
    minWorkingDays: 5,
    maxWorkingDays: 12,
    minBaseHours: 120,
    cloneMinBaseHours: 200,
    cloneMinWorkingDays: 12,
    complexityFloor: 'сложный',
    cloneComplexityFloor: 'enterprise',
    typicalModules: [
      { category: 'Архитектура приложения и окружения', hours: 10 },
      { category: 'UI/UX, дизайн-система и навигация', hours: 16 },
      { category: 'Авторизация и пользовательские профили', hours: 10 },
      { category: 'Основные экраны и бизнес-логика', hours: 28 },
      { category: 'Backend API и синхронизация данных', hours: 16 },
      { category: 'Push-уведомления и фоновые сценарии', hours: 8 },
      { category: 'Интеграции устройства и внешних сервисов', hours: 10 },
      { category: 'Offline-сценарии и обработка ошибок', hours: 8 },
      { category: 'Сборки, публикация и мониторинг', hours: 8 },
      { category: 'Документация и передача проекта', hours: 6 },
    ],
  },
  telegram: {
    label: 'Telegram-бот',
    minPriceRub: 140_000,
    maxPriceRub: 210_000,
    minWorkingDays: 2,
    maxWorkingDays: 5,
    minBaseHours: 24,
    complexityFloor: 'простой',
    typicalModules: [
      { category: 'Сценарии, состояния и структура бота', hours: 4 },
      { category: 'Команды, меню и пользовательские потоки', hours: 6 },
      { category: 'База данных и бизнес-логика', hours: 5 },
      { category: 'Интеграции и уведомления', hours: 4 },
      { category: 'Администрирование, деплой и мониторинг', hours: 5 },
    ],
  },
  crm: {
    label: 'CRM / Админ-панель',
    minPriceRub: 175_000,
    maxPriceRub: 315_000,
    minWorkingDays: 3,
    maxWorkingDays: 5,
    minBaseHours: 100,
    cloneMinBaseHours: 180,
    cloneMinWorkingDays: 5,
    complexityFloor: 'сложный',
    cloneComplexityFloor: 'enterprise',
    typicalModules: [
      { category: 'Аналитика процессов и архитектура данных', hours: 10 },
      { category: 'Авторизация, роли и права доступа', hours: 10 },
      { category: 'Основные сущности и рабочие процессы', hours: 22 },
      { category: 'Таблицы, фильтры, массовые действия и поиск', hours: 12 },
      { category: 'Дашборды, отчеты и экспорт', hours: 12 },
      { category: 'Автоматизации и уведомления', hours: 10 },
      { category: 'Интеграции с внешними системами', hours: 10 },
      { category: 'Журнал действий, безопасность и аудит', hours: 7 },
      { category: 'Деплой, мониторинг и документация', hours: 7 },
    ],
  },
  api: {
    label: 'API / Backend',
    minPriceRub: 280_000,
    maxPriceRub: 420_000,
    minWorkingDays: 2,
    maxWorkingDays: 5,
    minBaseHours: 80,
    complexityFloor: 'средний',
    typicalModules: [
      { category: 'Архитектура и модель данных', hours: 10 },
      { category: 'Авторизация, роли и безопасность', hours: 10 },
      { category: 'Основные API и бизнес-логика', hours: 24 },
      { category: 'Интеграции и фоновые задачи', hours: 12 },
      { category: 'Валидация, ошибки и журналирование', hours: 8 },
      { category: 'Документация API и примеры', hours: 5 },
      { category: 'CI/CD, мониторинг и деплой', hours: 11 },
    ],
  },
  custom: {
    label: 'Индивидуальный проект',
    // NOMAD (образовательная платформа автошколы): согласовано заказчиком
    // 300 000–500 000 ₽, 7–15 рабочих дней. «Платформа» здесь — НЕ соцсеть.
    minPriceRub: 300_000,
    maxPriceRub: 500_000,
    minWorkingDays: 7,
    maxWorkingDays: 15,
    minBaseHours: 60,
    complexityFloor: 'средний',
    typicalModules: [
      { category: 'Аналитика требований и архитектура', hours: 8 },
      { category: 'Интерфейс и пользовательские сценарии', hours: 12 },
      { category: 'Основной функционал', hours: 20 },
      { category: 'Данные, API и интеграции', hours: 10 },
      { category: 'Безопасность, деплой и документация', hours: 10 },
    ],
  },
};

const CLONE_REFERENCES: Array<CloneReference & { keywords: string[] }> = [
  { label: 'Ozon', type: 'marketplace', keywords: ['озон', 'ozon'] },
  { label: 'Wildberries', type: 'marketplace', keywords: ['wildberries', 'вайлдберриз'] },
  { label: 'Avito', type: 'marketplace', keywords: ['avito', 'авито'] },
  { label: 'Amazon', type: 'marketplace', keywords: ['amazon', 'амазон'] },
  { label: 'AliExpress', type: 'marketplace', keywords: ['aliexpress', 'алиэкспресс'] },
  { label: 'eBay', type: 'marketplace', keywords: ['ebay'] },
  { label: 'Uber', type: 'marketplace', keywords: ['uber', 'убер'] },
  { label: 'Яндекс Еда', type: 'marketplace', keywords: ['яндекс.еда', 'яндекс еда'] },
  { label: 'Instagram', type: 'social', keywords: ['instagram', 'инстаграм'] },
  { label: 'TikTok', type: 'social', keywords: ['tiktok', 'тикток'] },
  { label: 'YouTube', type: 'social', keywords: ['youtube', 'ютуб'] },
  { label: 'ВКонтакте', type: 'social', keywords: ['вконтакте', 'vk'] },
  { label: 'Facebook', type: 'social', keywords: ['facebook'] },
  { label: 'Notion', type: 'webapp', keywords: ['notion'] },
  { label: 'Trello', type: 'webapp', keywords: ['trello'] },
  { label: 'Jira', type: 'webapp', keywords: ['jira'] },
  { label: 'Bitrix24', type: 'crm', keywords: ['bitrix', 'битрикс'] },
  { label: 'amoCRM', type: 'crm', keywords: ['amocrm', 'амоcrm', 'амо срм'] },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundHours(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replaceAll('ё', 'е');
}

function getClarificationsText(clarifications?: Record<string, string>): string {
  if (!clarifications) return '';
  return Object.entries(clarifications)
    .map(([question, answer]) => `${question}: ${answer}`)
    .join('\n');
}

function detectKnownClone(text: string, selectedType: string): CloneReference | null {
  const normalized = normalizeText(text);
  const reference = CLONE_REFERENCES.find(item =>
    item.keywords.some(keyword => normalized.includes(normalizeText(keyword))),
  );

  if (!reference) return null;

  const hasCloneIntent = /(аналог|клон|копи[яю]|как\s+(?:у|в)|по\s+типу|подоби|полноценн.*верси)/i.test(normalized);
  const isIntegrationMention = /(интеграц|выгруз|api|синхронизац)/i.test(normalized);
  const selectedAsSameProductClass = (selectedType === reference.type || selectedType === 'custom') && !isIntegrationMention;
  const isShortProductDescription = normalized.length < 250 && !isIntegrationMention;

  if (!hasCloneIntent && !selectedAsSameProductClass && !isShortProductDescription) {
    return null;
  }

  return { label: reference.label, type: reference.type };
}

function normalizeComplexity(value?: string): Complexity {
  const normalized = normalizeText(value || '');
  if (normalized.includes('enterprise') || normalized.includes('энтерпрайз')) return 'enterprise';
  if (normalized.includes('слож')) return 'сложный';
  if (normalized.includes('сред')) return 'средний';
  return 'простой';
}

export function enforceComplexityFloor(value: Complexity, floor: Complexity): Complexity {
  const valueIndex = COMPLEXITY_ORDER.indexOf(value);
  const floorIndex = COMPLEXITY_ORDER.indexOf(floor);
  return COMPLEXITY_ORDER[Math.max(valueIndex, floorIndex)];
}

function sanitizeBreakdown(items?: BreakdownItem[]): BreakdownItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter(item => {
      const category = typeof item?.category === 'string' ? item.category.trim() : '';
      const hours = Number(item?.hours);
      const isServerCalculated = /(тест|qa|отлад|нагрузочн.*тест|сопутствующ.*расход)/i.test(category);
      return category.length > 0 && Number.isFinite(hours) && hours > 0 && !isServerCalculated;
    })
    .slice(0, 30)
    .map(item => ({
      category: item.category.trim().slice(0, 160),
      hours: roundHours(Math.min(Number(item.hours), 5000)),
    }));
}

function sumHours(items: BreakdownItem[]): number {
  return roundHours(items.reduce((sum, item) => sum + item.hours, 0));
}

function scaleBreakdownToTotal(items: BreakdownItem[], targetHours: number): BreakdownItem[] {
  const currentTotal = sumHours(items);
  if (currentTotal <= 0 || currentTotal === targetHours) return items;

  const ratio = targetHours / currentTotal;
  const scaled = items.map(item => ({
    ...item,
    hours: Math.max(0.5, roundHours(item.hours * ratio)),
  }));
  const difference = roundHours(targetHours - sumHours(scaled));

  if (difference !== 0 && scaled.length > 0) {
    const lastIndex = scaled.length - 1;
    scaled[lastIndex] = {
      ...scaled[lastIndex],
      hours: Math.max(0.5, roundHours(scaled[lastIndex].hours + difference)),
    };
  }

  return scaled;
}

function fallbackRecommendations(complexity: Complexity): string[] {
  const recommendations = [
    'Сначала зафиксируйте состав MVP и критерии приемки, чтобы новые идеи не расширяли бюджет во время разработки.',
    'Отдельно заложите ежемесячные расходы на хостинг, домен, почту, SMS и платные внешние сервисы.',
    'Перед запуском проверьте резервное копирование, права доступа и сценарии восстановления после ошибок.',
  ];

  if (complexity === 'сложный' || complexity === 'enterprise') {
    recommendations.push(
      'Для крупного проекта нужен поэтапный запуск: закрытое тестирование, ограниченная аудитория и только затем полная нагрузка.',
    );
  }

  return recommendations;
}

// Классификация по ТЗ: ИИ возвращает detectedType — он имеет приоритет над
// кнопкой формы. «Платформа»/«образовательная платформа» НЕ считается соцсетью.
const KNOWN_TYPES = Object.keys(PROJECT_PROFILES);

function normalizeDetectedType(value?: string): string | null {
  if (!value) return null;
  const normalized = normalizeText((value || '').trim());
  if ((PROJECT_PROFILES as Record<string, unknown>)[normalized]) return normalized;

  const aliases: Record<string, string> = {
    'социальная сеть': 'social', 'соцсеть': 'social', 'sns': 'social',
    'маркетплейс': 'marketplace', 'интернет-магазин': 'ecommerce', 'магазин': 'ecommerce',
    'веб-приложение': 'webapp', 'саас': 'webapp', 'веб приложение': 'webapp',
    'мобильное приложение': 'mobile', 'приложение': 'mobile',
    'телеграм': 'telegram', 'телеграм-бот': 'telegram', 'тг-бот': 'telegram',
    'crm': 'crm', 'админ-панель': 'crm',
    'api': 'api', 'бэкенд': 'api', 'backend': 'api',
    'лендинг': 'landing', 'корпоративный сайт': 'corporate', 'сайт': 'corporate',
    'игра': 'game', 'игровая': 'game',
    'индивидуальный': 'custom', 'кастом': 'custom', 'другое': 'custom', 'проект': 'custom',
  };
  return aliases[normalized] || null;
}

// Проверяет — реальный ли это тип social по ТЗ. Social = только настоящая
// соцсеть (лента, подписчики, профили, чат). Образовательные платформы,
// маркетплейсы и прочее — НЕ social, даже если AI так классифицировал.
function isValidSocialByDescription(description: string): boolean {
  const normalized = normalizeText(description);
  return /(лента\s+(новост|пост|запис)|подписч|подписк[аиу]|социальн\w*\s+(граф|сеть|платформ)|профил\w*\s+(пользовател|друг|подпис)|друз\w*\s+(список|профил)|новост\w*\s+(лента|поток|嫱)|мессенджер|чат\s+(комнат|груп)|мой\s+мир|стена\s+(пост|запис))/i.test(normalized);
}

export function getEstimationGuardrails(input: {
  projectType: string;
  description: string;
  clarifications?: Record<string, string>;
  designNeeded: boolean;
  detectedType?: string;
}): EstimationGuardrails {
  const clarificationsText = getClarificationsText(input.clarifications);
  const scopeText = `${input.description}\n${clarificationsText}`;
  const normalizedScope = normalizeText(scopeText);
  const knownClone = detectKnownClone(scopeText, input.projectType);
  // Приоритет: известный клон → тип по ТЗ от ИИ → кнопка формы.
  // social — только если ТЗ реально описывает соцсеть (лента, подписчики и т.д.)
  let effectiveType = knownClone?.type || normalizeDetectedType(input.detectedType) || input.projectType;
  if (effectiveType === 'social' && !isValidSocialByDescription(input.description)) {
    effectiveType = 'custom';
  }
  const profile = PROJECT_PROFILES[effectiveType] || PROJECT_PROFILES.custom;

  const isMvp = /(?:^|[\s"'(])(mvp|мвп)(?:$|[\s"')])|прототип|демо[-\s]?верси|первая версия|минимальн\w*\s+верси/i.test(normalizedScope);
  const isFullScope = /полный аналог|полноценн|все функции|весь функционал|production[-\s]?ready|промышленн/i.test(normalizedScope);
  const isHighLoad = /высок\w*\s+нагруз|нагрузочн|100[\s.,]?000|100к|миллион|федеральн|мультирегион|тысяч\w*\s+одновремен|high[-\s]?load/i.test(normalizedScope);

  let requiredBaseHours = knownClone
    ? profile.cloneMinBaseHours || profile.minBaseHours
    : profile.minBaseHours;
  let minimumWorkingDays = knownClone
    ? profile.cloneMinWorkingDays || profile.minWorkingDays
    : profile.minWorkingDays;
  let maximumWorkingDays = profile.maxWorkingDays;
  const complexityFloor = knownClone
    ? profile.cloneComplexityFloor || profile.complexityFloor
    : profile.complexityFloor;
  const reasons: string[] = [`минимальный профиль «${profile.label}»`];

  if (knownClone) {
    reasons.push(`масштаб известного сервиса ${knownClone.label}`);
  }

  if (knownClone && isMvp) {
    requiredBaseHours = Math.max(profile.minBaseHours, requiredBaseHours * 0.75);
    minimumWorkingDays = Math.max(profile.minWorkingDays, Math.ceil(minimumWorkingDays * 0.75));
    reasons.push('явно указан ограниченный MVP');
  } else if (isFullScope) {
    requiredBaseHours *= 1.15;
    minimumWorkingDays = Math.ceil(minimumWorkingDays * 1.1);
    reasons.push('заявлен полный продуктовый охват');
  }

  if (isHighLoad) {
    requiredBaseHours *= 1.15;
    minimumWorkingDays = Math.ceil(minimumWorkingDays * 1.1);
    reasons.push('требуются высокая нагрузка и эксплуатационная надежность');
  }

  if (input.designNeeded) {
    requiredBaseHours *= 1.08;
    reasons.push('нужен отдельный UI/UX и дизайн-система');
  }

  // Верхняя граница рабочих дней не превышает максимум профиля.
  maximumWorkingDays = clamp(maximumWorkingDays, minimumWorkingDays, profile.maxWorkingDays);

  return {
    effectiveType,
    profile,
    knownClone,
    isMvp,
    isFullScope,
    isHighLoad,
    requiredBaseHours: roundUp(requiredBaseHours, 5),
    minimumWorkingDays,
    maximumWorkingDays,
    complexityFloor,
    reasons,
  };
}

export function normalizeEstimate(input: NormalizeEstimateInput): EstimateResult {
  const guardrails = getEstimationGuardrails({
    projectType: input.projectType,
    description: input.description,
    clarifications: input.clarifications,
    designNeeded: input.designNeeded,
    detectedType: input.modelEstimate.detectedType,
  });

  // Детерминированные модули ИЗ ТЕКСТА ТЗ (ключевые слова), а НЕ из AI.
  // Одинаковый текст = одинаковые модули = одна цена.
  let breakdown = detectModulesFromText(input.description);
  let baseHours = sumHours(breakdown);
  const guardrailsApplied: string[] = [];

  if (baseHours < guardrails.requiredBaseHours) {
    if (input.description.length < 500 || guardrails.knownClone || breakdown.length < 3) {
      breakdown = guardrails.profile.typicalModules.map(item => ({ ...item }));
      if (guardrails.isMvp && sumHours(breakdown) > guardrails.requiredBaseHours) {
        breakdown = scaleBreakdownToTotal(breakdown, guardrails.requiredBaseHours);
      }
      baseHours = sumHours(breakdown);
    }

    if (baseHours < guardrails.requiredBaseHours) {
      const missingHours = roundHours(guardrails.requiredBaseHours - baseHours);
      const adjustmentCategory = guardrails.isHighLoad
        ? 'Нагрузочная архитектура, мониторинг и резервирование'
        : input.designNeeded
          ? 'Расширенный UI/UX, дизайн-система и адаптивные состояния'
          : 'Архитектура, интеграция и стабилизация масштаба';

      breakdown.push({ category: adjustmentCategory, hours: missingHours });
      baseHours = sumHours(breakdown);
    }

    guardrailsApplied.push(
      `Оценка модели поднята до минимального профиля: ${guardrails.requiredBaseHours} базовых часов.`,
    );
  }

  const modelComplexity = normalizeComplexity(input.modelEstimate.detectedComplexity);
  const detectedComplexity = enforceComplexityFloor(modelComplexity, guardrails.complexityFloor);
  if (detectedComplexity !== modelComplexity) {
    guardrailsApplied.push(
      `Сложность повышена до уровня «${detectedComplexity}» по масштабу проекта.`,
    );
  }

  const settings = COMPLEXITY_SETTINGS[detectedComplexity];
  const testingHours = roundHours(baseHours * settings.testingPercent);
  const testingCategory = detectedComplexity === 'enterprise' || guardrails.isHighLoad
    ? 'Тестирование, безопасность и проверка под нагрузкой'
    : 'Тестирование и отладка';

  const totalHours = roundHours(baseHours + testingHours);

  // ── Детерминированное ценообразование ────────────────────────────────
  // Цена считается по модулям из ТЗ (ключевые слова), а НЕ из AI.
  // Одинаковый текст ТЗ = одинаковые модули = одна цена.
  const urgencyMultiplier = input.urgentDeadline ? 1.25 : 1;

  let rawPrice = TOOL_FEE_RUB;
  let rawDays = 0;
  for (const item of breakdown) {
    const type = resolveModuleType(item.category);
    const size = sizeFromHours(item.hours);
    rawPrice += MODULE_PRICE_RUB[type][size];
    rawDays += MODULE_DAYS[size];
  }
  // Добавляем тестирование в breakdown после ценообразования:
  breakdown.push({ category: testingCategory, hours: testingHours });

  // Цена — ИЗ МОДУЛЕЙ ТЗ. Пол профиля НЕ влияет на цену — ТЗ определяет цену.
  // Флор = TOOL_FEE_RUB (абсолютный минимум). Профиль влияет ТОЛЬКО на коридор дней.
  const priceFloor = TOOL_FEE_RUB;
  const daysFloor = guardrails.minimumWorkingDays;
  const daysCeil = guardrails.maximumWorkingDays;

  const rawPriceMin = roundUp(rawPrice * urgencyMultiplier, 5000);
  const rawPriceMax = roundUp(rawPrice * 1.2 * urgencyMultiplier, 5000);
  const rawDaysMin = Math.round(rawDays * 0.7);
  const rawDaysMax = Math.round(rawDays * 1.5);

  if (rawPriceMin > guardrails.profile.maxPriceRub) {
    guardrailsApplied.push(
      `Модули ТЗ превышают тип «${guardrails.profile.label}» (потолок ${guardrails.profile.maxPriceRub.toLocaleString('ru-RU')} ₽). Цена определена по ТЗ, а не по кнопке.`,
    );
  }

  const priceMin = clamp(rawPriceMin, priceFloor, Infinity);
  const priceMax = clamp(rawPriceMax, priceMin, Infinity);
  const daysMin = clamp(rawDaysMin, daysFloor, daysCeil);
  const daysMax = clamp(rawDaysMax, daysMin, daysCeil);

  if (input.urgentDeadline) {
    guardrailsApplied.push(
      'Добавлена наценка 25% за приоритетную очередь и ускоренные согласования; объем работ не уменьшен.',
    );
  }

  const studioComparison = {
    priceMin: roundUp(priceMin * settings.studioPriceMinFactor, 50000),
    priceMax: roundUp(priceMax * settings.studioPriceMaxFactor, 50000),
    daysMin: Math.ceil(daysMin * settings.studioDaysMinFactor),
    daysMax: Math.ceil(daysMax * settings.studioDaysMaxFactor),
  };

  const recommendations = Array.isArray(input.modelEstimate.recommendations)
    ? input.modelEstimate.recommendations
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 5)
        .map(item => item.trim())
    : [];

  return {
    baseHours,
    testingHours,
    testingPercent: Math.round(settings.testingPercent * 100),
    totalHours,
    productiveHoursPerDay: PRODUCTIVE_HOURS_PER_DAY,
    days: daysMin,
    dailyRate: DAILY_RATE_RUB,
    operationalExpenses: TOOL_FEE_RUB,
    priceMin,
    priceMax,
    daysMin,
    daysMax,
    detectedComplexity,
    estimationBasis: guardrails.reasons.join('; '),
    guardrailsApplied,
    breakdown,
    studioComparison,
    recommendations: recommendations.length > 0
      ? recommendations
      : fallbackRecommendations(detectedComplexity),
  };
}
