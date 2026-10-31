// Калькулятор стоимости разработки «под ключ» для вайб-кодера.
//
// КТО СЧИТАЕТ: один разработчик, который собирает рабочий продукт вместе с
// AI-агентами и готовыми библиотеками. Это быстрее и дешевле студии, но это
// полноценная разработка: анализ ТЗ, архитектура, данные, интеграции,
// граничные случаи, проверка, деплой и передача проекта.
//
// ЧТО ВХОДИТ В ЦЕНУ: рабочий продукт целиком.
// ЧТО НЕ ВХОДИТ: хостинг, домен, подключение и настройка сторонних сервисов
// (онлайн-оплата, SMS, карты, OCR, внешние API) — они считаются отдельно.
// Если ТЗ прямо требует такой сервис, он не оценивается, а попадает в
// предупреждения (excludedFromPrice).
//
// МОДЕЛЬ РАСЧЁТА (детерминированная):
//   1. ОБЪЁМ. Модули определяются ИЗ ТЕКСТА (ТЗ + описание) по ключевым
//      словам, ПЛЮС выбранные в форме функции, ПЛЮС (осторожно) модули,
//      которые ИИ нашёл в ТЗ и которых нет в списке. Кнопка типа проекта —
//      формальность и на объём не влияет.
//   2. ЦЕНА. Сумма фиксированных цен модулей × коэффициенты объёма
//      (подробность ТЗ) и сложности + технический резерв (≥ 10 000 ₽).
//   3. СРОК. Дни модулей со скоростью вайб-кодера + буфер 3 дня.
//      Абсолютный минимум — 3 дня.
//   4. Полы/потолки по типу проекта нужны только чтобы не отдавать копейки
//      за сложные проекты и не улетать в студийные миллионы.
//
// Одинаковый вход = одинаковая цена: ИИ не «придумывает» стоимость, он
// только уточняет состав работ и задаёт вопросы.

/** Технический резерв: инструменты, подписки, тестовые окружения, домен
 *  для превью, платные вызовы API на время разработки. Минимум — 10 000 ₽. */
export const TECH_RESERVE_RUB = 10_000;

/** Буфер сверх чистой разработки: приёмка, правки, деплой, передача. */
export const SCHEDULE_BUFFER_DAYS = 3;

/** Абсолютный минимум срока — даже телеграм-бот не сдаётся быстрее. */
export const MIN_WORKING_DAYS = 3;

/** Абсолютный минимум чека: техрезерв + хотя бы минимальная работа. */
export const ABSOLUTE_MIN_PRICE_RUB = 20_000;

/** Наценка за срочность: приоритетная очередь, работа вечерами и в выходные. */
export const URGENT_MULTIPLIER = 1.25;

/** Ставка вайб-кодера, ₽/час. Нужна только для честного пересчёта модулей
 *  в часы в таблице работ. */
export const VIBE_HOURLY_RATE_RUB = 2_000;

/** Сколько «чистых» рабочих дней разработки даёт один день календаря при
 *  работе с AI-агентами (переиспользование, генерация, параллельные правки). */
const SPEED_FACTOR = 0.16;

/** Крупный проект собирается из переиспользуемых блоков: одинаковые списки,
 *  формы, права и уведомления не пишутся заново. Поэтому после N модулей
 *  каждый следующий стоит дешевле. Без этого соцсеть улетает в студийные
 *  миллионы, хотя делается одним человеком с AI. */
const REUSE_THRESHOLD_MODULES = 12;
const REUSE_DISCOUNT_PER_MODULE = 0.025;
const REUSE_DISCOUNT_MAX = 0.4;

function reuseFactor(modulesCount: number): number {
  const extra = Math.max(0, modulesCount - REUSE_THRESHOLD_MODULES);
  return 1 - Math.min(REUSE_DISCOUNT_MAX, extra * REUSE_DISCOUNT_PER_MODULE);
}

export type Complexity = 'простой' | 'средний' | 'сложный' | 'enterprise';

export interface BreakdownItem {
  category: string;
  hours: number;
  /** Цена модуля в ₽ (для модулей из ТЗ/ИИ). */
  price?: number;
  source?: string;
}

export interface ModelEstimate {
  detectedComplexity?: string;
  detectedType?: string;
  /** Модули, которые ИИ нашёл в ТЗ сверх известного списка. */
  modules?: Array<{ name?: string; category?: string; hours?: number; size?: string; scale?: string }>;
  /** Устаревшее поле: часы больше не управляют ценой. */
  breakdown?: BreakdownItem[];
  recommendations?: string[];
  excludedFromPrice?: string[];
}

export interface EstimateResult {
  // ── Цена ────────────────────────────────────────────────────────────
  priceMin: number;
  priceMax: number;
  /** Цена модулей до коэффициентов, ₽. */
  modulesPrice: number;
  /** Технический резерв в составе цены, ₽ (≥ 10 000). */
  techReserve: number;
  /** Наценка за срочность, ₽ (0 если проект не срочный). */
  urgencySurcharge: number;
  /** На сколько поднял пол по типу проекта, ₽ (0 если не применялся). */
  scopeFloorApplied: number;
  /** Подняли ли цену до пола по типу проекта. */
  floorApplied: boolean;
  /** Коэффициент сложности. */
  complexityFactor: number;
  /** Коэффициент подробности ТЗ. */
  volumeFactor: number;
  hourlyRate: number;

  // ── Сроки ───────────────────────────────────────────────────────────
  /** Дни чистой разработки (без буфера). */
  developmentDays: number;
  /** Буфер сверх разработки, дней (3). */
  bufferDays: number;
  daysMin: number;
  daysMax: number;
  /** @deprecated оставлено для совместимости, равно daysMin */
  days: number;
  currentWeekdays: number;
  currentCalendarDays: number;

  // ── Состав работ ────────────────────────────────────────────────────
  breakdown: BreakdownItem[];
  modulesCount: number;
  scopeSource: string;
  estimationBasis: string;
  guardrailsApplied: string[];
  excludedFromPrice: string[];

  // ── Справочно (совместимость с прошлой версией UI) ──────────────────
  baseHours: number;
  testingHours: number;
  testingPercent: number;
  totalHours: number;
  productiveHoursPerDay: number;
  dailyRate: number;
  operationalExpenses: number;
  detectedComplexity: Complexity;
  detectedType: string;
  recommendations: string[];
  comparable: {
    label: string;
    priceMin: number;
    priceMax: number;
    daysMin: number;
    daysMax: number;
  };
  /** @deprecated используйте comparable */
  studioComparison: { priceMin: number; priceMax: number; daysMin: number; daysMax: number };
  approximate?: boolean;
}

// ══════════════════════════════════════════════════════════════════════
// 1. КАТАЛОГ МОДУЛЕЙ — объём работ определяется ТОЛЬКО этим каталогом
// ══════════════════════════════════════════════════════════════════════

export type ModuleId =
  | 'base'
  | 'design'
  | 'auth'
  | 'user_profiles'
  | 'feed'
  | 'posts'
  | 'comments'
  | 'messenger'
  | 'groups'
  | 'notifications'
  | 'search'
  | 'events'
  | 'admin'
  | 'backend'
  | 'mobile'
  | 'integration'
  | 'highload'
  | 'ai_features'
  | 'video'
  | 'payment'
  | 'maps'
  | 'ocr'
  | 'analytics'
  | 'reviews'
  | 'gamification'
  | 'georeputation';

interface ModuleDef {
  id: ModuleId;
  name: string;
  /** Цена модуля, ₽. */
  price: number;
  /** Дни чистой разработки для вайб-кодера. */
  days: number;
  /** Ключевые слова в ТЗ/описании. */
  text: RegExp;
  /** Ключевые слова выбранных функций. */
  feature: RegExp;
}

const MODULES: ModuleDef[] = [
  {
    id: 'base',
    name: 'Базовая разработка: структура, основные экраны, сборка',
    price: 30_000,
    days: 1,
    text: /(сайт|лендинг|визитк|одностраничн|приложение|бот|платформ|сервис|портал|систем|кабинет|магазин)/i,
    feature: /(базов|основн)/i,
  },
  {
    id: 'design',
    name: 'Дизайн: UI/UX, дизайн-система, адаптивность',
    price: 25_000,
    days: 0.8,
    text: /(дизайн|ui\/ux|\bui\b|\bux\b|макет|figma|фигма|фирменн\w*\s+стил|адаптив|мобильн\w*\s+верси)/i,
    feature: /(дизайн|ui\/ux|адаптив)/i,
  },
  {
    id: 'auth',
    name: 'Регистрация, вход и безопасность',
    price: 20_000,
    days: 0.7,
    text: /(регистрац|авторизац|аутентификац|вход\s+в|логин|парол|учетн\w*\s+запис|учётн\w*\s+запис|подтвержден\w*\s+(телефон|email|почт)|двухфакторн|2fa|смс[-\s]?код|восстановлен\w*\s+доступ)/i,
    feature: /(авторизац|личный кабинет|логин|регистрац|профиль)/i,
  },
  {
    id: 'user_profiles',
    name: 'Профили пользователей и личный кабинет',
    price: 25_000,
    days: 0.7,
    text: /(профил|аккаунт|аватар|личн\w*\s+кабинет|онбординг|настройк\w*\s+приватност|приватност|друз|подписчик)/i,
    feature: /(профил|кабинет|аккаунт)/i,
  },
  {
    id: 'feed',
    name: 'Лента, подписки и алгоритм показа',
    price: 50_000,
    days: 1.1,
    text: /(лент|фид|подписк|подписчик|социальн\w*\s+граф|рекомендац|бесконечн\w*\s+скролл|новостн\w*\s+поток)/i,
    feature: /(лент|подписк)/i,
  },
  {
    id: 'posts',
    name: 'Публикация и управление контентом',
    price: 30_000,
    days: 0.7,
    text: /(публикац|пост|запис|контент|медиа|фото|галере|загрузк\w*\s+(файл|фото|изображен)|редактор|черновик)/i,
    feature: /(загрузк\w*\s+файл|контент|публикац|пост|фото)/i,
  },
  {
    id: 'comments',
    name: 'Комментарии, реакции и сохранения',
    price: 20_000,
    days: 0.5,
    text: /(коммент|реакц|лайк|сохранен|закладк|репост|ответ\w*\s+на\s+коммент)/i,
    feature: /(коммент|реакц|лайк)/i,
  },
  {
    id: 'messenger',
    name: 'Личные сообщения и чаты',
    price: 45_000,
    days: 1.1,
    text: /(личн\w*\s+сообщен|сообщен|мессенджер|(?<![а-яa-z])чат(?!-?бот|ов\b)|переписк|диалог)/i,
    feature: /(чат|сообщен|мессенджер)/i,
  },
  {
    id: 'groups',
    name: 'Сообщества, группы и форумы',
    price: 35_000,
    days: 0.9,
    text: /(сообществ|групп|форум|клуб|ветк\w*\s+обсужд|тематическ\w*\s+раздел)/i,
    feature: /(сообществ|групп|форум|клуб)/i,
  },
  {
    id: 'notifications',
    name: 'Уведомления: внутренние, email, push, Telegram',
    price: 20_000,
    days: 0.6,
    text: /(уведомлен|нотификац|email|e-mail|почтов\w*\s+рассылк|push|пуш|напомин|рассылк)/i,
    feature: /(уведомлен|push|email|sms|рассылк|напомин)/i,
  },
  {
    id: 'search',
    name: 'Поиск, фильтры и каталог',
    price: 35_000,
    days: 0.9,
    text: /(поиск|фильтр|сортировк|каталог|категори|подбор|расширенн\w*\s+поиск|умн\w*\s+поиск)/i,
    feature: /(поиск|фильтр|каталог|сортировк)/i,
  },
  {
    id: 'events',
    name: 'События, бронирование и расписание',
    price: 30_000,
    days: 0.8,
    text: /(мероприят|событи|афиш|билет|бронирован|расписани|календар|запис\w*\s+на)/i,
    feature: /(бронирован|расписани|календар|событи|запис)/i,
  },
  {
    id: 'admin',
    name: 'Админ-панель, модерация и роли',
    price: 35_000,
    days: 1.0,
    text: /(админ|панель управлени|модерац|жалоб|роли|прав\w*\s+доступ|оператор|диспетчер|back[-\s]?office)/i,
    feature: /(админ|модерац|роли)/i,
  },
  {
    id: 'backend',
    name: 'Backend, API, база данных и бизнес-логика',
    price: 35_000,
    days: 1.0,
    text: /(бэкенд|backend|\bapi\b|сервер|база данн|\bбд\b|database|postgres|mysql|supabase|firebase|бизнес[-\s]?логик|архитектур|микросервис|graphql|интеграц|вебхук|webhook|синхронизац|выгрузк|экспорт|импорт)/i,
    feature: /(интеграц|crm|api|выгрузк|экспорт|импорт)/i,
  },
  {
    id: 'mobile',
    name: 'Мобильное приложение (Android/iOS)',
    price: 55_000,
    days: 1.3,
    text: /(мобильн\w*\s+приложен|приложени\w*\s+(android|ios)|android|ios|flutter|react native|kotlin|swift|pwa)/i,
    feature: /(мобильн|android|ios)/i,
  },
  {
    id: 'integration',
    name: 'Внешние интеграции и обмен данными',
    price: 20_000,
    days: 0.6,
    text: /(интеграц|внешн\w*\s+сервис|сторонн\w*\s+сервис|подключен\w*\s+сервис|\bsdk\b|вебхук|webhook|обмен данн|api партнер|шина данн)/i,
    feature: /(интеграц|1с|склад|erp)/i,
  },
  {
    id: 'highload',
    name: 'Нагрузка, кэширование, мониторинг и отказоустойчивость',
    price: 45_000,
    days: 1.1,
    text: /(высок\w*\s+нагруз|нагрузочн|масштабир|отказоустойчив|кэширован|балансировк|мониторинг|резервирован|миллион\w*\s+пользовател|100[\s.,]?000\s+пользовател|федеральн\w*\s+масштаб)/i,
    feature: /(нагрузк|масштаб|мониторинг)/i,
  },
  {
    id: 'ai_features',
    name: 'AI-функции: подбор, ассистент, рекомендации',
    price: 45_000,
    days: 1.0,
    text: /(ии[-\s]?(ассистент|поиск|подбор|модерац|рекоменд)|\bии\b|нейросет|искусственн\w*\s+интеллект|gpt|llm|machine learning|машинн\w*\s+обучен|рекомендательн\w*\s+систем|чат[-\s]?бот|ai[-\s]?(ассистент|поиск|подбор|модерац))/i,
    feature: /(\bии\b|\bai\b|нейросет|gpt|llm|ассистент)/i,
  },
  {
    id: 'video',
    name: 'Видео, стриминг и короткие видео',
    price: 45_000,
    days: 1.0,
    text: /(видео|video|видеохостинг|стрим|трансляц|\bлапс|laps|reels|коротк\w*\s+вертикальн\w*\s+видео|shorts)/i,
    feature: /(видео|стрим|трансляц)/i,
  },
  {
    id: 'payment',
    name: 'Оплата, подписки и выплаты',
    price: 50_000,
    days: 1.2,
    text: /(онлайн[-\s]?оплат|прием платеж|приём платеж|платежн\w*\s+(шлюз|систем)|эквайринг|подписк\w*\s+(на|оплат)|биллинг|выплат\w*\s+продавц|юkassa|юкасс|stripe|tinkoff|тинькофф|робокасс|оплат\w*\s+(заказ|курс|товар|подписк))/i,
    feature: /(оплат|платеж|подписк|эквайринг|биллинг)/i,
  },
  {
    id: 'maps',
    name: 'Геосервисы, карты и маршруты',
    price: 20_000,
    days: 0.6,
    text: /(карт[аыуоей]|карт\b|геолокац|гео[-\s]?сервис|маршрут|яндекс\s*карт|google\s*maps|2gis|2гис|координат|пункт\w*\s+выдачи)/i,
    feature: /(карт|гео|маршрут)/i,
  },
  {
    id: 'ocr',
    name: 'Распознавание документов и чеков',
    price: 20_000,
    days: 0.6,
    text: /(распознаван|сканер|скан\w*\s+(чек|документ)|qr[-\s]?код|штрих[-\s]?код|проверк\w*\s+чек|ocr)/i,
    feature: /(распознаван|qr|скан|чек)/i,
  },
  {
    id: 'analytics',
    name: 'Аналитика, графики и отчёты',
    price: 20_000,
    days: 0.6,
    text: /(аналитик|график|диаграмм|отчет|отчёт|дашборд|метрик|статистик|воронк)/i,
    feature: /(аналитик|график|отчет|отчёт|дашборд|метрик)/i,
  },
  {
    id: 'reviews',
    name: 'Отзывы, оценки и рейтинг исполнителей',
    price: 20_000,
    days: 0.5,
    text: /(отзыв|оценк\w*\s+(товар|исполнител|услуг|продавц|работ)|рейтинг\w*\s+(исполнител|продавц|товар)|звезд|звёзд)/i,
    feature: /(отзыв|рейтинг)/i,
  },
  {
    id: 'gamification',
    name: 'Достижения, уровни и игровые механики',
    price: 25_000,
    days: 0.7,
    text: /(достижен|ачивк|уровн|балл|очк|геймификац|наград|бейдж|квест|лидерборд|рейтинг\w*\s+активност|weekly|еженедельн\w*\s+рейтинг)/i,
    feature: /(достижен|балл|уровн|геймификац|наград)/i,
  },
  {
    id: 'georeputation',
    name: 'Репутация, доверие и система жалоб',
    price: 25_000,
    days: 0.7,
    text: /(репутац|систем\w*\s+довери|довери\w*\s+сообществ|уровень\w*\s+водител|водительск\w*\s+рейтинг|driver\s*score|nomad\s*score)/i,
    feature: /(репутац|довери)/i,
  },
];

const MODULE_BY_ID = new Map(MODULES.map(module => [module.id, module]));

/** Сколько модулей реально вмещает формат проекта. Визитка не может состоять
 *  из десяти подсистем: если ключевые слова нашли больше — оставляем только
 *  самые значимые. Для крупных форматов ограничения мягкие. */
const SCHEME_MODULE_CAP: Record<string, number> = {
  landing: 3,
  telegram: 5,
  corporate: 8,
  api: 10,
  crm: 12,
  webapp: 14,
  ecommerce: 14,
  mobile: 16,
  marketplace: 22,
  social: 26,
  game: 24,
  custom: 20,
};

/** Модули, которые считаются «сердцем» формата и никогда не выбрасываются. */
const ESSENTIAL_MODULES: ModuleId[] = ['base', 'backend', 'auth'];

/** Даёт ли ИИ оценку объёма (список модулей). Если да — выброшенные
 *  ключевыми словами модули уже учтены в его списке, поэтому отбрасывать
 *  мелочь не нужно: это только занизило бы смету. */
function fitModulesToScheme(
  items: SelectedModule[],
  projectType: string,
  hasAiModules: boolean,
): SelectedModule[] {
  const cap = SCHEME_MODULE_CAP[projectType] ?? SCHEME_MODULE_CAP.custom;

  // Отбрасываем только откровенный шум от ключевых слов — и только если
  // состав подтверждён ИИ. Порог низкий: лучше сохранить дешёвый модуль,
  // чем потерять часть работы.
  const priced = priceModules(items);
  const values = priced.map(item => item.price).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)] || 0;
  const cutoff = hasAiModules ? 0 : Math.max(10_000, median * 0.15);

  const kept = items.filter(item => item.def.price * item.scale >= cutoff);
  const result = kept.length > 0 ? kept : items;
  if (result.length <= cap) return result;

  const essential = result.filter(item => ESSENTIAL_MODULES.includes(item.def.id));
  const rest = result
    .filter(item => !ESSENTIAL_MODULES.includes(item.def.id))
    .sort((a, b) => b.def.price * b.scale - a.def.price * a.scale);
  return [...essential, ...rest.slice(0, Math.max(0, cap - essential.length))];
}

// Категории ИИ-модулей → известные модули каталога
const AI_MODULE_HINTS: Array<{ patterns: RegExp; ids: ModuleId[] }> = [
  { patterns: /(дизайн|ui|ux|макет|верстк|вёрстк|адаптив|интерфейс)/i, ids: ['design'] },
  { patterns: /(регистрац|авторизац|вход|логин|парол|доступ|безопасн|2fa)/i, ids: ['auth'] },
  { patterns: /(профил|аккаунт|кабинет|онбординг|приватност)/i, ids: ['user_profiles'] },
  { patterns: /(лент|фид|подписк|рекомендац)/i, ids: ['feed'] },
  { patterns: /(публикац|пост|контент|медиа|фото|галере|загрузк)/i, ids: ['posts'] },
  { patterns: /(коммент|реакц|лайк|сохранен)/i, ids: ['comments'] },
  { patterns: /(сообщен|мессенджер|чат|переписк)/i, ids: ['messenger'] },
  { patterns: /(сообществ|групп|форум|клуб)/i, ids: ['groups'] },
  { patterns: /(уведомлен|email|push|рассылк|напомин)/i, ids: ['notifications'] },
  { patterns: /(поиск|фильтр|каталог|сортировк)/i, ids: ['search'] },
  { patterns: /(мероприят|событи|бронирован|расписани|календар)/i, ids: ['events'] },
  { patterns: /(админ|модерац|роли|жалоб|оператор)/i, ids: ['admin'] },
  { patterns: /(api|backend|бэкенд|база данн|бд|сервер|схем\w*\s+данн|бизнес[-\s]?логик|архитектур)/i, ids: ['backend'] },
  { patterns: /(мобильн|android|ios|flutter|приложени)/i, ids: ['mobile'] },
  { patterns: /(интеграц|webhook|вебхук|внешн|sdk|api партнер|обмен данн)/i, ids: ['integration'] },
  { patterns: /(нагрузк|масштаб|производительн|кэш|мониторинг|отказоустойчив)/i, ids: ['highload'] },
  { patterns: /(\bии\b|\bai\b|нейросет|gpt|llm|ассистент|рекомендац)/i, ids: ['ai_features'] },
  { patterns: /(видео|video|стрим|трансляц|reels|shorts)/i, ids: ['video'] },
  { patterns: /(оплат|платеж|платёж|эквайринг|подписк|биллинг|выплат)/i, ids: ['payment'] },
  { patterns: /(карт|гео|маршрут|локац)/i, ids: ['maps'] },
  { patterns: /(распознаван|скан|qr|чек|ocr)/i, ids: ['ocr'] },
  { patterns: /(аналитик|график|отчет|отчёт|дашборд|метрик|статистик)/i, ids: ['analytics'] },
  { patterns: /(отзыв|рейтинг|оценк)/i, ids: ['reviews'] },
  { patterns: /(достижен|уровн|балл|очк|награ|геймификац|лидерборд)/i, ids: ['gamification'] },
  { patterns: /(репутац|довери)/i, ids: ['georeputation'] },
];

/** Работы, которые в цену НЕ входят: их заказчик подключает отдельно.
 *  Если ТЗ их требует, честно предупреждаем, а не прячем в цену. */
const EXCLUDED_SERVICES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(онлайн[-\s]?оплат|прием платеж|приём платеж|платежн\w*\s+(шлюз|систем)|эквайринг|оплат\w*\s+(карт|заказ|курс|товар|подписк)|юkassa|юкасс|stripe|тинькофф|робокасс)/i, label: 'онлайн-оплата и платёжный шлюз — подключение и настройка' },
  { pattern: /(\bsms\b|смс[-\s]?(код|рассылк|уведомл)|sms[-\s]?(код|рассылк|уведомл))/i, label: 'SMS-сервис (коды, рассылки) — подключение и настройка' },
  { pattern: /(яндекс\s*карт|google\s*maps|2gis|2гис|картограф|геокодер|карт[аыуоей]|карт\b)/i, label: 'карты и геосервисы — подключение и лимиты' },
  { pattern: /(распознаван\w*\s+чек|проверк\w*\s+чек|скан\w*\s+чек|ocr)/i, label: 'распознавание чеков и документов (OCR) — подключение сервиса' },
  { pattern: /(внешн\w*\s+api|сторонн\w*\s+api|api партнер|партнерск\w*\s+api|интеграц\w*\s+с\s+(?!сайт)\S+)/i, label: 'внешние API и партнёрские сервисы — доступы, ключи, лимиты' },
  { pattern: /(push[-\s]?уведомлен|пуш[-\s]?уведомлен|firebase|apns|fcm)/i, label: 'push-уведомления — настройка сервиса доставки' },
  { pattern: /(смс|sms|whatsapp|ватсап|телеграм[-\s]?бот\w*\s+через|рассылк\w*\s+по\s+базе)/i, label: 'рассылки и мессенджеры — платные сервисы и лимиты' },
  { pattern: /(хостинг|хост\w*\s+и|сервер\w*\s+аренд|vps|выделенн\w*\s+сервер|домен|dns)/i, label: 'хостинг, домен и серверная инфраструктура' },
];

// ══════════════════════════════════════════════════════════════════════
// 2. ПОЛЫ И ПОТОЛКИ ПО ТИПУ ПРОЕКТА
//    Тип — формальность для объёма, но он защищает от абсурда:
//    соцсеть не может стоить 80 000 ₽, а визитка — 900 000 ₽.
// ══════════════════════════════════════════════════════════════════════

export interface ProjectProfile {
  label: string;
  minPriceRub: number;
  maxPriceRub: number;
  minDays: number;
  maxDays: number;
  complexityFloor: Complexity;
}

export const PROJECT_PROFILES: Record<string, ProjectProfile> = {
  landing: { label: 'Лендинг / Визитка', minPriceRub: 30_000, maxPriceRub: 150_000, minDays: 3, maxDays: 10, complexityFloor: 'простой' },
  corporate: { label: 'Корпоративный сайт', minPriceRub: 80_000, maxPriceRub: 350_000, minDays: 4, maxDays: 14, complexityFloor: 'простой' },
  ecommerce: { label: 'Интернет-магазин', minPriceRub: 200_000, maxPriceRub: 700_000, minDays: 5, maxDays: 18, complexityFloor: 'средний' },
  webapp: { label: 'Веб-приложение (SaaS)', minPriceRub: 250_000, maxPriceRub: 900_000, minDays: 6, maxDays: 20, complexityFloor: 'средний' },
  social: { label: 'Социальная сеть / Платформа', minPriceRub: 500_000, maxPriceRub: 1_600_000, minDays: 7, maxDays: 21, complexityFloor: 'сложный' },
  game: { label: 'Игровая платформа', minPriceRub: 600_000, maxPriceRub: 1_800_000, minDays: 10, maxDays: 30, complexityFloor: 'сложный' },
  marketplace: { label: 'Маркетплейс', minPriceRub: 400_000, maxPriceRub: 1_500_000, minDays: 8, maxDays: 25, complexityFloor: 'сложный' },
  mobile: { label: 'Мобильное приложение', minPriceRub: 450_000, maxPriceRub: 1_400_000, minDays: 8, maxDays: 25, complexityFloor: 'средний' },
  telegram: { label: 'Telegram-бот', minPriceRub: 25_000, maxPriceRub: 250_000, minDays: 3, maxDays: 12, complexityFloor: 'простой' },
  crm: { label: 'CRM / Админ-панель', minPriceRub: 220_000, maxPriceRub: 800_000, minDays: 6, maxDays: 20, complexityFloor: 'средний' },
  api: { label: 'API / Backend', minPriceRub: 220_000, maxPriceRub: 800_000, minDays: 5, maxDays: 18, complexityFloor: 'средний' },
  custom: { label: 'Индивидуальный проект', minPriceRub: 80_000, maxPriceRub: 800_000, minDays: 4, maxDays: 20, complexityFloor: 'простой' },
};

const DEFAULT_PROFILE = PROJECT_PROFILES.custom;
const MAX_PRICE_CEILING = 2_500_000;
const MAX_DAYS_CEILING = 40;

const COMPLEXITY_ORDER: Complexity[] = ['простой', 'средний', 'сложный', 'enterprise'];

const TIER_FACTOR = [1, 1.25, 1.5, 1.8];

const TESTING_PERCENT: Record<Complexity, number> = {
  'простой': 0.15,
  'средний': 0.2,
  'сложный': 0.25,
  enterprise: 0.3,
};

// ══════════════════════════════════════════════════════════════════════
// 3. ОПРЕДЕЛЕНИЕ ТИПА ПРОЕКТА
// ══════════════════════════════════════════════════════════════════════

function normalizeText(value: string): string {
  return (value || '').toLowerCase().replaceAll('ё', 'е');
}

const TYPE_ALIASES: Record<string, string> = {
  'социальная сеть': 'social', 'соцсеть': 'social', 'соц сеть': 'social', 'sns': 'social', 'social': 'social',
  'маркетплейс': 'marketplace', 'маркет плейс': 'marketplace',
  'интернет-магазин': 'ecommerce', 'интернет магазин': 'ecommerce', 'магазин': 'ecommerce', 'ecommerce': 'ecommerce',
  'веб-приложение': 'webapp', 'веб приложение': 'webapp', 'саас': 'webapp', 'saas': 'webapp', 'webapp': 'webapp',
  'мобильное приложение': 'mobile', 'приложение': 'mobile', 'mobile': 'mobile',
  'телеграм': 'telegram', 'телеграм-бот': 'telegram', 'телеграм бот': 'telegram', 'тг-бот': 'telegram', 'бот': 'telegram', 'telegram': 'telegram',
  'crm': 'crm', 'црм': 'crm', 'админ-панель': 'crm', 'админ панель': 'crm',
  'api': 'api', 'бэкенд': 'api', 'backend': 'api', 'сервер': 'api',
  'лендинг': 'landing', 'визитка': 'landing', 'landing': 'landing',
  'корпоративный сайт': 'corporate', 'сайт': 'corporate', 'corporate': 'corporate',
  'игра': 'game', 'игровая': 'game', 'game': 'game',
  'индивидуальный': 'custom', 'кастом': 'custom', 'другое': 'custom', 'проект': 'custom', 'custom': 'custom', 'платформа': 'custom',
};

/** Приводит ответ ИИ к известному типу проекта. */
export function normalizeDetectedType(value?: string): string | null {
  if (!value) return null;
  const normalized = normalizeText(value).trim();
  if (PROJECT_PROFILES[normalized]) return normalized;
  return TYPE_ALIASES[normalized] || null;
}

/**
 * Определяет тип проекта. Порядок важен:
 *   1. тип, который ИИ вывел из ТЗ (если он валиден);
 *   2. разбор текста (когда ИИ недоступен);
 *   3. выбор пользователя в форме, только если описание отсутствует.
 * При наличии описания или ТЗ кнопка не задаёт ценовые границы.
 */
export function resolveProjectType(
  aiType: string | undefined,
  selectedType: string,
  text: string,
): string {
  const fromAi = normalizeDetectedType(aiType);
  if (fromAi) return fromAi;

  // При наличии ТЗ выбор кнопки не участвует даже в резервной классификации.
  if (text.trim()) return classifyTypeFromText(text, 'custom');

  const fromForm = normalizeDetectedType(selectedType);
  if (fromForm && fromForm !== 'custom') return fromForm;

  return classifyTypeFromText(text, selectedType) || 'custom';
}

/** Детерминированная классификация по ТЗ (когда ИИ недоступен или выбран
 *  вариант «Своё / Другое»). */
export function classifyTypeFromText(text: string, fallbackType: string): string {
  const t = normalizeText(text);
  if (/(социальн\w*\s+сет|соцсет|новостн\w*\s+лент|лента\s+(новост|пост|запис)|подписчик|личн\w*\s+сообщен)/.test(t)) return 'social';
  if (/маркетплейс/.test(t)) return 'marketplace';
  if (/(интернет[-\s]?магазин|корзин|оформлен\w*\s+заказ|каталог\w*\s+товар|доставк\w*\s+заказ)/.test(t)) return 'ecommerce';
  if (/(мобильн\w*\s+приложен|android|ios|flutter|react native)/.test(t)) return 'mobile';
  if (/(телеграм|telegram|тг[-\s]?бот)/.test(t)) return 'telegram';
  if (/(игров\w*\s+платформ|\bигр[аыу]\b|game)/.test(t)) return 'game';
  if (/(crm|црм|воронк\w*\s+продаж|сделк\w*\s+с\s+клиент)/.test(t)) return 'crm';
  if (/(лендинг|одностраничн|визитк)/.test(t)) return 'landing';
  if (/(корпоративн\w*\s+сайт|сайт\s+компан|каталог\s+услуг)/.test(t)) return 'corporate';
  if (/(\bapi\b|бэкенд|backend|микросервис)/.test(t)) return 'api';
  return normalizeDetectedType(fallbackType) || fallbackType || 'custom';
}

/** Соцсеть = реальная лента + подписки + профили + сообщения, а не «платформа». */
export function isValidSocialByDescription(description: string): boolean {
  const normalized = normalizeText(description);
  return /(лента|подписк|подписчик|социальн\w*\s+(сеть|граф|платформ)|профил\w*\s+(пользовател|участник)|сообществ|личн\w*\s+сообщен|мессенджер|друз)/.test(normalized);
}

// ══════════════════════════════════════════════════════════════════════
// 4. ОБЪЁМ: сбор модулей из ТЗ, функций и ИИ
// ══════════════════════════════════════════════════════════════════════

interface SelectedModule {
  def: ModuleDef;
  source: string;
  /** Во сколько раз модуль больше базового (по объёму ТЗ). */
  scale: number;
}

function scaleFromFrequency(mentions: number): number {
  if (mentions <= 1) return 1;
  const extra = Math.floor((mentions - 1) / 3);
  return Math.min(1.5, 1 + extra * 0.15);
}

function mergeModules(
  text: string,
  aiModules: ModelEstimate['modules'] | undefined,
  features: string[],
): SelectedModule[] {
  // Ключ — строка: у модулей ИИ может не быть id из каталога.
  const selected = new Map<string, SelectedModule>();

  // 4.1. Текст (ТЗ + описание) — главный источник объёма
  for (const def of MODULES) {
    const matches = text.match(new RegExp(def.text.source, 'gi'));
    if (matches && matches.length > 0) {
      selected.set(def.id, {
        def,
        source: 'ТЗ',
        scale: scaleFromFrequency(matches.length),
      });
    }
  }

  // 4.2. Функции, выбранные в форме (добавляются, если их нет из ТЗ)
  for (const feature of features) {
    for (const def of MODULES) {
      if (!def.feature.test(feature)) continue;
      if (!selected.has(def.id)) {
        selected.set(def.id, { def, source: 'выбрано в форме', scale: 1 });
      }
      break;
    }
  }

  // 4.3. Модули от ИИ — только те, которых нет в каталоге.
  //      Осторожно: максимум 6 позиций и только «продуктовые» подсистемы.
  let aiAdded = 0;
  for (const raw of aiModules || []) {
    if (aiAdded >= 6) break;
    const category = typeof (raw?.name || raw?.category) === 'string'
      ? String(raw?.name || raw?.category).trim()
      : '';
    if (category.length < 3) continue;
    if (/(тестирован|отладк|\bqa\b|деплой|документац|аналитик\w*\s+требован|резерв|запас|сопровожден)/i.test(category)) continue;

    const hint = AI_MODULE_HINTS.find(entry => entry.patterns.test(category));
    if (hint && hint.ids.some(id => !selected.has(id))) {
      for (const id of hint.ids) {
        if (selected.has(id)) continue;
        const def = MODULE_BY_ID.get(id);
        if (def) selected.set(id, { def, source: 'ИИ нашёл в ТЗ', scale: 1 });
      }
      continue;
    }
    if (hint) continue; // полностью покрыто каталогом

    const sizeHint = String(raw?.size || raw?.scale || '').toLowerCase();
    const scale = /(крупн|large|больш|сложн)/.test(sizeHint) ? 1.4 : 1;
    const price = Math.round(30_000 * scale);
    selected.set(`ai:${category.slice(0, 80)}`, {
      def: {
        id: 'base',
        name: category.slice(0, 80),
        price,
        days: 0.8 * scale,
        text: /$^/,
        feature: /$^/,
      },
      source: 'ИИ нашёл в ТЗ',
      scale: 1,
    });
    aiAdded += 1;
  }

  // 4.4. Пустой вход → не отдаём ноль
  if (selected.size === 0) {
    const base = MODULE_BY_ID.get('base');
    if (base) selected.set('base', { def: base, source: 'минимум по умолчанию', scale: 1 });
  }

  return [...selected.values()];
}

function detectExcludedServices(text: string): string[] {
  const found: string[] = [];
  for (const service of EXCLUDED_SERVICES) {
    if (service.pattern.test(text) && !found.includes(service.label)) {
      found.push(service.label);
    }
  }
  return found.slice(0, 6);
}

// ══════════════════════════════════════════════════════════════════════
// 5. ЦЕНА И СРОК
// ══════════════════════════════════════════════════════════════════════

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Правильная форма слова «модуль» для числа: 1 модуль, 2 модуля, 24 модуля. */
function moduleWord(count: number): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return 'модулей';
  switch (count % 10) {
    case 1: return 'модуль';
    case 2:
    case 3:
    case 4: return 'модуля';
    default: return 'модулей';
  }
}

/** Подробное ТЗ = больше скрытых требований. Коэффициент 1.0 … 1.35. */
function volumeFactorFromText(textLength: number): number {
  const factor = 1 + (textLength / 12_000) * 0.35;
  return Math.round(clamp(factor, 1, 1.35) * 100) / 100;
}

function complexityIndex(value?: string): number {
  const normalized = normalizeText(value || '');
  if (normalized.includes('enterprise') || normalized.includes('энтерпрайз')) return 3;
  if (normalized.includes('слож')) return 2;
  if (normalized.includes('сред')) return 1;
  return 0;
}

// Потолки цены по составу: одна позиция не может стоить сколько угодно.
// Это верхняя граница для соло-разработчика с AI, а не студийный бюджет:
// полностью готовый модуль со всей обвязкой, а не «человеко-месяцы».
const MODULE_PRICE_CAP: Record<ModuleId, number> = {
  base: 30_000,
  design: 45_000,
  auth: 35_000,
  user_profiles: 40_000,
  feed: 120_000,
  posts: 60_000,
  comments: 45_000,
  messenger: 100_000,
  groups: 65_000,
  notifications: 50_000,
  search: 60_000,
  events: 50_000,
  admin: 70_000,
  backend: 70_000,
  mobile: 150_000,
  integration: 60_000,
  highload: 90_000,
  ai_features: 90_000,
  video: 100_000,
  payment: 80_000,
  maps: 45_000,
  ocr: 45_000,
  analytics: 50_000,
  reviews: 45_000,
  gamification: 55_000,
  georeputation: 60_000,
};

interface PricedModule {
  id: ModuleId;
  name: string;
  price: number;
  days: number;
  source: string;
}

function priceModules(items: SelectedModule[]): PricedModule[] {
  return items
    .map(item => {
      const raw = item.def.price * item.scale;
      const cap = MODULE_PRICE_CAP[item.def.id] ?? raw;
      return {
        id: item.def.id,
        name: item.def.name,
        price: roundUpTo(Math.min(raw, cap), 500),
        days: item.def.days * (item.scale > 1 ? 1.1 : 1),
        source: item.source,
      };
    })
    .sort((a, b) => b.price - a.price);
}

/** Приводит цены модулей к итоговой сумме с учётом скидки за переиспользование,
 *  чтобы таблица работ сходилась с итогом копейка в копейку. */
function scalePricesToTotal(items: PricedModule[], target: number): PricedModule[] {
  const current = items.reduce((sum, item) => sum + item.price, 0);
  if (current <= 0 || target <= 0) return items;

  const scaled = items.map(item => ({
    ...item,
    price: roundUpTo(Math.round((item.price / current) * target), 500),
  }));
  const difference = target - scaled.reduce((sum, item) => sum + item.price, 0);
  if (difference !== 0 && scaled.length > 0) {
    scaled[0] = { ...scaled[0], price: Math.max(500, scaled[0].price + difference) };
  }
  return scaled;
}

function daysFromModules(items: SelectedModule[], volumeFactor: number): number {
  const total = items.reduce((sum, item) => sum + item.def.days * (item.scale > 1 ? 1.1 : 1), 0);
  return Math.max(1, Math.min(28, total * SPEED_FACTOR * volumeFactor));
}

function fallbackRecommendations(complexity: Complexity, excluded: string[]): string[] {
  const recommendations = [
    'В цену входит разработка рабочего продукта под ключ. Хостинг, домен, подключение и настройка платных сторонних сервисов оплачиваются отдельно.',
    'Технический резерв (инструменты, подписки, тестовые окружения, вызовы API на время разработки) уже включён в стоимость.',
    'Запускайте проект поэтапно: сначала основной сценарий на ограниченной аудитории, затем остальные функции.',
  ];

  if (excluded.length > 0) {
    recommendations.unshift(
      `Отдельно предстоит подключить: ${excluded.map(item => item.replace(/ — .*$/, '')).join(', ')}.`,
    );
  }

  if (complexity === 'сложный' || complexity === 'enterprise') {
    recommendations.push(
      'Для проекта такого объёма заранее зафиксируйте границы первой версии: так новые идеи не сдвинут срок и бюджет.',
    );
  }

  return recommendations.slice(0, 5);
}

// ══════════════════════════════════════════════════════════════════════
// 6. ОСНОВНОЙ РАСЧЁТ
// ══════════════════════════════════════════════════════════════════════

export interface NormalizeEstimateInput {
  modelEstimate: ModelEstimate;
  projectType: string;
  description: string;
  clarifications?: Record<string, string>;
  designNeeded: boolean;
  urgentDeadline: boolean;
  features?: string[];
  customFeatures?: string[];
  techStack?: string[];
}

const PRODUCTIVE_HOURS_PER_DAY = 6;

export function normalizeEstimate(input: NormalizeEstimateInput): EstimateResult {
  const clarificationsText = input.clarifications
    ? Object.entries(input.clarifications).map(([question, answer]) => `${question}: ${answer}`).join('\n')
    : '';
  // Описание — главный источник. Уточнения клиента дополняют, но не заменяют.
  const scopeText = [input.description, clarificationsText].filter(Boolean).join('\n');
  const normalizedScope = normalizeText(scopeText);
  const features = [...(input.features || []), ...(input.customFeatures || [])];

  // ── Тип проекта (формальность для объёма, нужен для полов/потолков) ──
  let detectedType = resolveProjectType(
    input.modelEstimate.detectedType,
    input.projectType,
    scopeText,
  );
  if (detectedType === 'social' && !isValidSocialByDescription(scopeText)) {
    // Тип social включается только для настоящей соцсети: «платформа» ≠ соцсеть
    detectedType = 'custom';
  }
  const profile = PROJECT_PROFILES[detectedType] || DEFAULT_PROFILE;

  // ── Объём ────────────────────────────────────────────────────────────
  const selected = mergeModules(scopeText, input.modelEstimate.modules, features);
  if (input.designNeeded) {
    const design = MODULE_BY_ID.get('design');
    if (design && !selected.some(item => item.def.id === 'design')) {
      selected.push({ def: design, source: 'выбрано в форме', scale: 1 });
    }
  }
  const scheme = fitModulesToScheme(
    selected,
    detectedType,
    Array.isArray(input.modelEstimate.modules) && input.modelEstimate.modules.length > 0,
  );

  const pricedRaw = priceModules(scheme);
  const modulesCount = pricedRaw.length;
  const reuse = reuseFactor(modulesCount);
  const modulesPrice = roundUpTo(
    pricedRaw.reduce((sum, item) => sum + item.price, 0) * reuse,
    500,
  );
  // Цены в таблице приводим к итоговой сумме, чтобы «Итого» совпадало.
  const priced = reuse < 0.999 ? scalePricesToTotal(pricedRaw, modulesPrice) : pricedRaw;

  // ── Коэффициенты ─────────────────────────────────────────────────────
  const volumeFactor = volumeFactorFromText(scopeText.length);
  const complexity = clamp(
    Math.max(
      complexityIndex(input.modelEstimate.detectedComplexity),
      complexityIndex(profile.complexityFloor),
    ),
    0,
    3,
  ) as 0 | 1 | 2 | 3;
  const detectedComplexity = COMPLEXITY_ORDER[complexity];
  // «Запас» на неизвестность: набор функций большой, а ТЗ короткое
  const uncertaintyFactor = scopeText.length < 900 && modulesCount >= 6 ? 1.1 : 1;
  const complexityFactor = TIER_FACTOR[complexity];

  const techReserve = TECH_RESERVE_RUB;
  const urgent = Boolean(input.urgentDeadline);

  const subtotal = roundUpTo(
    (modulesPrice + techReserve) * volumeFactor * complexityFactor * uncertaintyFactor,
    500,
  );

  const scopePrice = Math.max(profile.minPriceRub, modulesPrice);
  const priceFloor = Math.max(ABSOLUTE_MIN_PRICE_RUB, Math.round(scopePrice * 0.7), techReserve * 2);
  // Потолок — это цена конкретного типа проекта у одного разработчика с AI,
  // а не студийный бюджет: соцсеть ≈ 1,3 млн, магазин ≈ 0,95 млн.
  const profileCeiling = Math.round(profile.maxPriceRub * 1.15);
  const priceCeiling = Math.min(MAX_PRICE_CEILING, Math.max(profileCeiling, Math.round(scopePrice * 1.2)));

  // Пол по объёму описанной системы. Нужен, когда в ТЗ мало букв, но описана
  // крупная сложная система: заказчик не должен получить 350 000 ₽ за соцсеть
  // только потому, что описание короткое. Включается ТОЛЬКО при явных
  // признаках сложности — иначе он задирал бы цены небольшим проектам.
  const isComplexSystem = complexity >= 2 && modulesCount >= 10;
  const marketFloorBase = isComplexSystem ? 240_000 + Math.max(0, modulesCount - 8) * 20_000 : 0;

  const guardrailsApplied: string[] = [];
  const reasons: string[] = [];

  // Проверка здравым смыслом: полный цикл у одного разработчика — это
  // ограниченное число дней. Если арифметика даёт завышенную дневную ставку,
  // подтягиваем её к реальности, чтобы не выставлять студийный чек.
  // Полы по типу проекта применяются ПОСЛЕ этого шага и имеют приоритет.
  const rateCap = VIBE_HOURLY_RATE_RUB * 1.8 * PRODUCTIVE_HOURS_PER_DAY;
  const totalWorkDays = Math.max(1, modulesCount * 0.8);
  let askPrice = subtotal;
  if (askPrice / totalWorkDays > rateCap) {
    askPrice = rateCap * totalWorkDays;
    reasons.push('скорость работы одного разработчика с AI');
  }

  // Рыночная нижняя граница для сложных систем: за соцсеть или маркетплейс
  // нельзя просить 300 000 ₽. Считаем базу и умножаем на сложность.
  const marketFloor = marketFloorBase * complexityFactor;
  let basePrice = Math.max(askPrice, marketFloor, priceFloor);
  if (basePrice > askPrice) {
    reasons.push(isComplexSystem && marketFloor >= priceFloor
      ? `минимальная рыночная цена такой системы («${profile.label}»)`
      : `минимальный уровень «${profile.label}»`);
  }
  if (basePrice > priceCeiling) {
    basePrice = priceCeiling;
    reasons.push(`потолок для формата «${profile.label}»`);
  }

  // Срочность применяется ПОСЛЕ полов: наценка за скорость не должна
  // «съедаться» минимальной ценой проекта.
  const urgencySurcharge = urgent ? roundUpTo(basePrice * (URGENT_MULTIPLIER - 1), 500) : 0;
  const priceMinRaw = basePrice + urgencySurcharge;
  const floorApplied = basePrice > subtotal;
  const scopeFloorApplied = floorApplied ? basePrice - subtotal : 0;

  if (floorApplied && reasons.length > 0) {
    guardrailsApplied.push(
      `Цена поднята до ${basePrice.toLocaleString('ru-RU')} ₽: ${reasons.join(', ')}. Ниже этой суммы такой объём не делается.`,
    );
  }

  const priceMin = roundUpTo(priceMinRaw, 5_000);
  const priceMax = roundUpTo(priceMinRaw * 1.25, 5_000);
  // ── Сроки ────────────────────────────────────────────────────────────
  const developmentDays = daysFromModules(scheme, volumeFactor);
  const typeMinDays = Math.max(MIN_WORKING_DAYS, profile.minDays);
  const typeMaxDays = Math.max(profile.maxDays, typeMinDays);
  let daysMin = Math.ceil(developmentDays + SCHEDULE_BUFFER_DAYS);
  if (daysMin < typeMinDays) {
    daysMin = typeMinDays;
  }
  if (daysMin < MIN_WORKING_DAYS) daysMin = MIN_WORKING_DAYS;
  const daysMax = Math.min(
    Math.max(Math.ceil(daysMin * 1.4), daysMin + 2),
    clamp(Math.max(typeMaxDays, daysMin + 2), daysMin + 2, MAX_DAYS_CEILING),
  );

  const dayBuffer = Math.ceil(developmentDays * 0.2) + SCHEDULE_BUFFER_DAYS;

  // ── Сравнение с обычным разработчиком/студией ────────────────────────
  // Для Enterprise задаём отдельный ориентир студийного цикла:
  // минимум около двух месяцев (40 рабочих дней), диапазон от 40 до 60 дней.
  const studioDaysMin = Math.max(
    detectedComplexity === 'enterprise' ? 40 : 0,
    daysMin + 2,
    Math.ceil(daysMin * 1.8),
  );
  const comparable = {
    label: 'Обычный разработчик или студия',
    priceMin: roundUpTo(priceMin * 2.6, 50_000),
    priceMax: roundUpTo(priceMax * 2.8 + 100_000, 50_000),
    daysMin: studioDaysMin,
    daysMax: Math.max(
      detectedComplexity === 'enterprise' ? 60 : 0,
      studioDaysMin + 5,
      daysMax + 5,
      Math.ceil(daysMax * 2.2),
    ),
  };

  // ── Часы (справочно, для таблицы работ) ──────────────────────────────
  const moduleHours = priced.map(item => ({
    ...item,
    hours: Math.max(2, Math.round((item.price / VIBE_HOURLY_RATE_RUB) * 2) / 2),
  }));
  const baseHours = Math.round(moduleHours.reduce((sum, item) => sum + item.hours, 0));

  const breakdown: BreakdownItem[] = moduleHours.map(item => ({
    category: item.name,
    hours: item.hours,
    price: item.price,
    source: item.source,
  }));
  const testingPercent = Math.round(TESTING_PERCENT[detectedComplexity] * 100);
  const testingHours = Math.round(baseHours * TESTING_PERCENT[detectedComplexity]);
  const totalHours = baseHours + testingHours;
  breakdown.push({
    category: `Тестирование, деплой и передача проекта (${testingPercent}%)`,
    hours: testingHours,
    price: 0,
    source: 'рассчитано сервером',
  });

  const excludedFromPrice = detectExcludedServices(normalizedScope);
  const aiRecommendations = Array.isArray(input.modelEstimate.recommendations)
    ? input.modelEstimate.recommendations
        .filter(item => typeof item === 'string' && item.trim().length > 5)
        .slice(0, 3)
        .map(item => item.trim())
    : [];
  const recommendations = aiRecommendations.length > 0
    ? [...aiRecommendations, ...fallbackRecommendations(detectedComplexity, excludedFromPrice)].slice(0, 5)
    : fallbackRecommendations(detectedComplexity, excludedFromPrice);

  // ── Пояснения ────────────────────────────────────────────────────────
  const sources = [...new Set(priced.map(item => item.source))];
  const scopeSource = sources.length > 0 ? sources.join(' + ') : 'минимум по умолчанию';
  const estimationBasis = [
    `объём: ${modulesCount} ${moduleWord(modulesCount)} из описания и ТЗ`,
    `формат по содержанию ТЗ — «${profile.label}» (выбор типа в форме не влияет на цену при наличии ТЗ)`,
    detectedComplexity !== 'простой' ? `сложность «${detectedComplexity}» (×${complexityFactor})` : 'сложность «простой» (×1)',
    volumeFactor > 1 ? `подробное ТЗ (×${volumeFactor})` : 'короткое ТЗ (×1)',
    reuse < 0.999 ? `переиспользование блоков (×${Math.round(reuse * 100) / 100})` : 'без скидки за переиспользование',
  ].join('; ');

  guardrailsApplied.unshift(
    `В цену включён технический резерв ${techReserve.toLocaleString('ru-RU')} ₽ (инструменты, подписки, тестовые окружения, вызовы API на время разработки).`,
  );
  if (reuse < 0.999) {
    guardrailsApplied.push(
      `Проект крупный: ${modulesCount} ${moduleWord(modulesCount)} переиспользуют общие блоки (права, списки, формы, уведомления), поэтому применена скидка ${Math.round((1 - reuse) * 100)}% — иначе такой объём стоил бы по цене студии.`,
    );
  }
  guardrailsApplied.push(
    `Срок = чистая разработка (${Math.round(developmentDays * 10) / 10} дн.) + буфер ${SCHEDULE_BUFFER_DAYS} дня на приёмку, правки и передачу проекта. Минимум по любому проекту — ${MIN_WORKING_DAYS} дня.`,
  );
  if (urgent) {
    guardrailsApplied.push(
      `Наценка ${Math.round((URGENT_MULTIPLIER - 1) * 100)}% за срочность: приоритетная очередь и ускоренные согласования. Объём работ не сокращён.`,
    );
  }

  return {
    priceMin,
    priceMax,
    modulesPrice,
    techReserve,
    urgencySurcharge,
    scopeFloorApplied,
    floorApplied,
    complexityFactor,
    volumeFactor,
    hourlyRate: VIBE_HOURLY_RATE_RUB,

    developmentDays: Math.round(developmentDays * 10) / 10,
    bufferDays: SCHEDULE_BUFFER_DAYS,
    daysMin,
    daysMax,
    days: daysMin,
    currentWeekdays: daysMin,
    currentCalendarDays: dayBuffer > 0 ? Math.ceil(daysMin * 1.4) : daysMin,

    breakdown,
    modulesCount,
    scopeSource,
    estimationBasis,
    guardrailsApplied,
    excludedFromPrice,

    baseHours,
    testingHours,
    testingPercent,
    totalHours,
    productiveHoursPerDay: PRODUCTIVE_HOURS_PER_DAY,
    dailyRate: VIBE_HOURLY_RATE_RUB * PRODUCTIVE_HOURS_PER_DAY,
    operationalExpenses: techReserve,
    detectedComplexity,
    detectedType,
    recommendations,
    comparable,
    studioComparison: {
      priceMin: comparable.priceMin,
      priceMax: comparable.priceMax,
      daysMin: comparable.daysMin,
      daysMax: comparable.daysMax,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// 7. СОВМЕСТИМОСТЬ (используется в API для передачи контекста в ИИ)
// ══════════════════════════════════════════════════════════════════════

export interface EstimationGuardrails {
  effectiveType: string;
  profile: ProjectProfile;
  requiredBaseHours: number;
  minimumWorkingDays: number;
  maximumWorkingDays: number;
  complexityFloor: Complexity;
  reasons: string[];
}

export function getEstimationGuardrails(input: {
  projectType: string;
  description: string;
  clarifications?: Record<string, string>;
  designNeeded: boolean;
  detectedType?: string;
}): EstimationGuardrails {
  const clarificationsText = input.clarifications
    ? Object.entries(input.clarifications).map(([question, answer]) => `${question}: ${answer}`).join('\n')
    : '';
  const scopeText = [input.description, clarificationsText].filter(Boolean).join('\n');

  let effectiveType = resolveProjectType(input.detectedType, input.projectType, scopeText);
  if (effectiveType === 'social' && !isValidSocialByDescription(scopeText)) {
    effectiveType = 'custom';
  }
  const profile = PROJECT_PROFILES[effectiveType] || DEFAULT_PROFILE;

  return {
    effectiveType,
    profile,
    requiredBaseHours: 0,
    minimumWorkingDays: Math.max(MIN_WORKING_DAYS, profile.minDays),
    maximumWorkingDays: profile.maxDays,
    complexityFloor: profile.complexityFloor,
    reasons: [`профиль «${profile.label}»`],
  };
}

export function enforceComplexityFloor(value: Complexity, floor: Complexity): Complexity {
  const valueIndex = COMPLEXITY_ORDER.indexOf(value);
  const floorIndex = COMPLEXITY_ORDER.indexOf(floor);
  return COMPLEXITY_ORDER[Math.max(valueIndex, floorIndex)];
}
