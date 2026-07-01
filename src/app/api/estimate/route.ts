import { NextRequest, NextResponse } from 'next/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Единственная модель — NVIDIA Mistral Large 3
const PRIMARY_MODEL = 'mistralai/mistral-large-3-675b-instruct-2512';
const PRIMARY_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const DAILY_RATE = 5000; // рублей в день
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
  totalHours: number;
  days: number;
  dailyRate: number;
  priceMin: number;
  priceMax: number;
  daysMin: number;
  daysMax: number;
  detectedComplexity?: string;
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

// ══════════════════════════════════════════════════════════════
// СПРАВОЧНИК ТИПИЧНЫХ МОДУЛЕЙ ДЛЯ ИЗВЕСТНЫХ ПРОЕКТОВ
// ══════════════════════════════════════════════════════════════
// Когда описание КОРОТКОЕ (<500 символов), но проект подразумевает
// большую сложность — ИИ ОБЯЗАН развернуть его в полный список
// модулей на основе этого справочника.

// ══════════════════════════════════════════════════════════════
// СПРАВОЧНИК МОДУЛЕЙ — РЕАЛЬНАЯ AI-РАЗРАБОТКА 2026
// ══════════════════════════════════════════════════════════════
// КРИТИЧНО: AI генерирует 90% кода за минуты. Используются готовые
// шаблоны, библиотеки, UI-киты. Разработчик только настраивает и проверяет.

const PROJECT_REFERENCE_CATALOG: Record<string, {
  label: string;
  minHours: number;
  typicalModules: { name: string; hours: number }[];
}> = {
  ecommerce: {
    label: 'Интернет-магазин',
    minHours: 3,
    typicalModules: [
      { name: 'Каталог + Карточка товара (AI-шаблон)', hours: 0.8 },
      { name: 'Корзина и чекаут (готовое решение)', hours: 0.5 },
      { name: 'Платёжная система (интеграция)', hours: 0.7 },
      { name: 'Авторизация + Личный кабинет (шаблон)', hours: 0.5 },
      { name: 'Админ-панель (автогенерация CRUD)', hours: 0.8 },
      { name: 'Уведомления (сервис)', hours: 0.2 },
      { name: 'SEO + Базовая настройка', hours: 0.3 },
    ],
  },
  marketplace: {
    label: 'Маркетплейс (аналог ОЗОН / Wildberries / Avito)',
    minHours: 5,
    typicalModules: [
      { name: 'Каталог + Поиск + Фильтры (AI)', hours: 0.7 },
      { name: 'Карточка + Корзина + Чекаут (шаблоны)', hours: 0.8 },
      { name: 'Платёжная система (API)', hours: 0.5 },
      { name: 'Личный кабинет покупателя', hours: 0.4 },
      { name: 'Личный кабинет продавца', hours: 0.7 },
      { name: 'Финансы продавца', hours: 1 },
      { name: 'Интеграция доставки', hours: 0.6 },
      { name: 'Админ-панель (автогенерация)', hours: 0.8 },
      { name: 'Чат (библиотека)', hours: 0.6 },
      { name: 'Уведомления + Отзывы', hours: 0.4 },
      { name: 'Базовая настройка + деплой', hours: 0.4 },
    ],
  },
  social: {
    label: 'Социальная сеть / Платформа',
    minHours: 5,
    typicalModules: [
      { name: 'Авторизация + Профили (шаблон)', hours: 0.5 },
      { name: 'Лента / Timeline (готовый компонент)', hours: 1 },
      { name: 'Подписки / Друзья (логика)', hours: 0.5 },
      { name: 'Публикация контента (компонент)', hours: 0.8 },
      { name: 'Лайки + Комментарии (готовое)', hours: 0.4 },
      { name: 'Чат (WebSocket-библиотека)', hours: 1.5 },
      { name: 'Уведомления (сервис)', hours: 0.4 },
      { name: 'Админ-панель (автогенерация)', hours: 0.7 },
      { name: 'Поиск (AI)', hours: 0.5 },
    ],
  },
  webapp: {
    label: 'Веб-приложение (SaaS)',
    minHours: 3,
    typicalModules: [
      { name: 'Авторизация (готовое решение)', hours: 0.4 },
      { name: 'Основной функционал (AI-генерация)', hours: 1.5 },
      { name: 'Dashboard (шаблон)', hours: 0.7 },
      { name: 'API / Backend (автогенерация)', hours: 0.6 },
      { name: 'Платёжная система (интеграция)', hours: 0.7 },
      { name: 'Админ-панель (автогенерация)', hours: 0.5 },
      { name: 'Уведомления (сервис)', hours: 0.2 },
    ],
  },
  game: {
    label: 'Игровая платформа',
    minHours: 8,
    typicalModules: [
      { name: 'Игровой движок / сцена (AI + библиотека)', hours: 3 },
      { name: 'Игровая логика (кастомная)', hours: 2 },
      { name: 'Авторизация + Профили (шаблон)', hours: 0.4 },
      { name: 'Система ачивок (AI-генерация контента)', hours: 0.8 },
      { name: 'Лидерборды (готовый компонент)', hours: 0.4 },
      { name: 'Мультиплеер (WebSocket-библиотека)', hours: 2.5 },
      { name: 'Покупки (интеграция)', hours: 0.7 },
      { name: 'Админ-панель (автогенерация)', hours: 0.5 },
    ],
  },
  crm: {
    label: 'CRM / Админ-панель',
    minHours: 2.5,
    typicalModules: [
      { name: 'Авторизация + Роли (готовое)', hours: 0.4 },
      { name: 'CRUD сущности (автогенерация)', hours: 1 },
      { name: 'Dashboard + Графики (AI-шаблон)', hours: 0.8 },
      { name: 'Отчёты + Экспорт (библиотека)', hours: 0.5 },
      { name: 'Уведомления (сервис)', hours: 0.2 },
      { name: 'Интеграции (API)', hours: 0.5 },
    ],
  },
  landing: {
    label: 'Лендинг / Визитка',
    minHours: 0.5,
    typicalModules: [
      { name: 'Дизайн + Верстка полная (AI v0.dev)', hours: 0.5 },
      { name: 'Форма + CTA (компонент)', hours: 0.1 },
      { name: 'SEO (автоматизация)', hours: 0.1 },
    ],
  },
  corporate: {
    label: 'Корпоративный сайт',
    minHours: 1,
    typicalModules: [
      { name: 'Дизайн + Главная (AI-генерация)', hours: 0.5 },
      { name: 'Внутренние страницы (AI-шаблоны)', hours: 0.5 },
      { name: 'Блог / CMS (готовое решение)', hours: 0.4 },
      { name: 'Формы (компоненты)', hours: 0.2 },
      { name: 'SEO (автоматизация)', hours: 0.1 },
    ],
  },
  mobile: {
    label: 'Мобильное приложение',
    minHours: 3,
    typicalModules: [
      { name: 'Навигация + Экраны (AI-шаблон)', hours: 0.7 },
      { name: 'Авторизация (готовое)', hours: 0.4 },
      { name: 'Основной функционал (AI-генерация)', hours: 1.2 },
      { name: 'Push-уведомления (сервис)', hours: 0.3 },
      { name: 'Интеграции (камера, GPS)', hours: 0.6 },
      { name: 'Публикация в сторы', hours: 0.3 },
    ],
  },
  api: {
    label: 'API / Backend',
    minHours: 2,
    typicalModules: [
      { name: 'Архитектура (AI-ассист)', hours: 0.3 },
      { name: 'Авторизация (готовое)', hours: 0.4 },
      { name: 'CRUD эндпоинты (автогенерация)', hours: 0.8 },
      { name: 'Бизнес-логика (кастом)', hours: 0.7 },
      { name: 'Интеграции (API)', hours: 0.5 },
      { name: 'Документация (AI + Swagger)', hours: 0.1 },
    ],
  },
  telegram: {
    label: 'Telegram бот',
    minHours: 1,
    typicalModules: [
      { name: 'Бот целиком (библиотека telegraf/grammy + AI)', hours: 1.5 },
      { name: 'БД и интеграции (если нужны)', hours: 0.5 },
      { name: 'Админ-панель (если нужна)', hours: 0.5 },
    ],
  },
};

// Ключевые слова для определения "клонов" известных сервисов
const CLONE_KEYWORDS: Record<string, string> = {
  'озон': 'marketplace',
  'ozon': 'marketplace',
  'wildberries': 'marketplace',
  'вайлдберриз': 'marketplace',
  'avito': 'marketplace',
  'авито': 'marketplace',
  'aliexpress': 'marketplace',

  'amazon': 'marketplace',
  'амазон': 'marketplace',
  'ebay': 'marketplace',
  'eBay': 'marketplace',
  'юла': 'marketplace',
  'youla': 'marketplace',
  'instagram': 'social',
  'инстаграм': 'social',
  'тикток': 'social',
  'tiktok': 'social',
  'youtube': 'social',
  'ютуб': 'social',
  'вконтакте': 'social',
  'vk': 'social',
  'facebook': 'social',
  'мемо': 'social',
  'reddit': 'social',
  'upwork': 'marketplace',
  'фриланс': 'marketplace',
  'хабр': 'social',
  'dribbble': 'marketplace',
  'behance': 'marketplace',
  'uber': 'marketplace',
  'яндекс.еда': 'marketplace',
  'delivery club': 'marketplace',
  'доставка еды': 'marketplace',
  'coursera': 'webapp',
  'skillbox': 'webapp',
  'udemy': 'webapp',
  'notion': 'webapp',
  'trello': 'webapp',
  'jira': 'webapp',
  'bitrix': 'crm',
  'amocrm': 'crm',
  'monday': 'crm',
};

const SYSTEM_PROMPT_SHORT = `Ты — калькулятор IT-проектов (AI-DRIVEN 2026). Используются готовые решения + AI-агенты.

ПРАВИЛА:
1. ТЗ = главное. Галочки из формы = подсказки.
2. Объединяй мелочи: "Бот: меню+воронка+БД" = 1 модуль, НЕ 10.
3. Breakdown: 5-15 строк. НЕ дроби.
4. Telegram-бот: 1-7 часов обычно.
5. Лендинг: 0.5-5 часов.
6. Админка: 2-10 часов.
7. +12% тестов (AI пишет).
8. +2 дня страховки всегда.
9. finalDays = Math.ceil(hours/7) + 2.

ОЦЕНКИ (С AI):
• Страница: 0.1-0.3ч
• Форма: 0.1-0.3ч
• Авторизация (Clerk): 0.2-0.5ч
• API: 0.1-0.3ч
• Админ CRUD: 0.3-1ч
• Чат (библиотека): 1-2ч
• Telegram-бот простой: 0.3-0.7ч
• Telegram-бот средний: 1-3ч
• Telegram-бот сложный: 3-7ч`;

// Функция выбора промпта в зависимости от размера
function selectSystemPrompt(totalChars: number): string {
  // Большое ТЗ (>100K символов) — короткий промпт
  if (totalChars > 100000) return SYSTEM_PROMPT_SHORT;
  // Среднее/малое — полный промпт
  return SYSTEM_PROMPT;
}

const SYSTEM_PROMPT = `Ты — калькулятор стоимости IT-проектов для VIBE-разработки (AI-DRIVEN DEVELOPMENT). 

🤖 КОНТЕКСТ 2026: Проекты создаются с помощью AI-агентов (Kiro, Cursor, Windsurf + Claude/GPT/Llama) и ГОТОВЫХ РЕШЕНИЙ. 

⚡️ КЛЮЧЕВОЕ: Разработчик НЕ пишет код с нуля! Используются:
- AI генерирует целые разделы за минуты (v0.dev, Cursor)
- Готовые UI-киты и компоненты (shadcn/ui, Radix, MUI)
- Готовые решения для авторизации (Clerk, Supabase Auth, NextAuth)
- Готовые платёжные интеграции (Stripe, Paddle)
- CRUD-панели автогенерируются (Refine, React Admin)
- Чаты из библиотек (Stream Chat, Socket.io шаблоны)
- AI пишет тесты автоматически

РЕАЛЬНЫЙ КЕЙС: Маркетплейс NOMAD (традиционно 62-75 дней для команды) реализован за 2-3 дня одним разработчиком с AI-агентами и готовыми решениями. 1 день — генерация и интеграция, 2 дня — тесты и правки.

══════════════════════════════════════
ВАЖНЕЙШЕЕ ПРАВИЛО: РАЗВЁРТЫВАНИЕ КОРОТКИХ ОПИСАНИЙ
══════════════════════════════════════

Если описание/ТЗ КОРОТКОЕ (менее 500 символов), но проект подразумевает большую сложность — ТЫ ОБЯЗАН:

1. Проанализировать ТИП ПРОЕКТА и все ключевые слова в описании.
2. Если в описании упоминается известный сервис (Озон, Wildberries, Avito, Uber, Instagram и т.п.) — это означает "аналог этого сервиса". Ты должен РАЗЛОЖИТЬ его на все типичные модули.
3. Использовать справочник типичных модулей (если он предоставлен в контексте) как основу.
4. НИКОГДА не оценивать проект как "простой" только потому, что описание короткое. Длина описания ≠ сложность проекта.

ПРИМЕРЫ НЕПРАВИЛЬНОЙ ОЦЕНКИ (так НЕ НУЖНО):
❌ "Сделать аналог ОЗОН" → "30 часов, простой проект" (ОШИБКА! Описание короткое, но проект ОГРОМНЫЙ)
❌ "Маркетплейс" → "40 часов" (ОШИБКА! Маркетплейс — это всегда enterprise)

ПРИМЕРЫ ПРАВИЛЬНОЙ ОЦЕНКИ:
✅ "Сделать аналог ОЗОН" → разложить на 25-30 модулей (каталог, корзина, продавец, логистика, доставка, модерация, аналитика...) с учётом AI-разработки
✅ "Фриланс-биржа" → разложить на модули (профили, заказы, споры, оплата, чат, рейтинг) с учётом AI-генерации

══════════════════════════════════════
РЕАЛЬНОЕ ВРЕМЯ С AI-АГЕНТАМИ (2026)
══════════════════════════════════════

⚡️ AI ГЕНЕРИРУЕТ 90% КОДА ЗА МИНУТЫ. Время указано с учётом:
- AI генерирует целые разделы кода (Kiro/Cursor/Windsurf)
- Дизайн создаётся AI за минуты (v0.dev, Figma AI, Canva)
- Используются ГОТОВЫЕ библиотеки и UI-киты
- Контент пишет AI массово (GPT-4, Claude)
- Изображения генерирует AI (Midjourney, DALL-E)
- Тесты пишет AI автоматически
- CRUD-панели автогенерируются

Разработчик: промпты → проверка → финальная интеграция (10% работы)

═══ БАЗОВЫЕ МОДУЛИ (С ГОТОВЫМИ РЕШЕНИЯМИ) ═══

• Простая страница/экран (AI-шаблон): 0.1-0.3 часа
• Форма с валидацией (готовый компонент): 0.1-0.3 часа
• Авторизация (готовое решение Clerk/Supabase): 0.2-0.5 часа
• API эндпоинт (автогенерация): 0.1-0.3 часа
• WebSocket / real-time (готовая библиотека): 0.7-1.5 часа
• Раздел админ-панели (CRUD автогенерация): 0.3-1 час
• Дизайн раздела (AI v0.dev полная генерация): 0.05-0.2 часа
• Платёжная система (интеграция Stripe/ЮKassa): 0.5-1 час
• 3D сцена (Three.js + AI-ассистенты): 1.5-4 часа
• Массовая генерация контента AI (100 ачивок): 0.3-0.7 часа (всё вместе!)
• Email/SMS сервис (готовый API): 0.1-0.3 часа
• Cron-задачи (AI-генерация): 0.2-0.5 часа
• Поиск / фильтры (готовые компоненты): 0.3-1 час
• Уведомления (готовый сервис): 0.1-0.5 часа
• Реферальная система (шаблон): 0.5-1 час
• Антибот / безопасность (готовые middleware): 0.3-1 час
• Деплой + настройка (автоматизация): 0.2-0.7 часа
• Интеграция внешнего API: 0.3-1 час
• Каталог товаров (AI-шаблон + библиотека): 0.5-1 час
• Корзина + чекаут (готовое решение): 0.3-0.7 часа
• Личный кабинет (UI-кит шаблон): 0.3-0.7 часа
• Чат (готовая WebSocket-библиотека): 1-2 часа
• Система модерации (AI-ассистед): 0.7-2 часа
• Профиль пользователя (шаблон): 0.2-0.5 часа
• Лента / timeline (готовый компонент): 0.5-1 час

**Telegram-боты (библиотека telegraf/grammy делает 90%):**
• Простой бот (меню + команды): 0.3-0.7 часа
• Средний бот (меню + воронка + БД): 1-3 часа
• Сложный бот (воронка + интеграции + админка): 3-7 часов

═══ СЛОЖНЫЕ МОДУЛИ (AI + КАСТОМИЗАЦИЯ) ═══

• Многоскладская логистика: 2-4 часа
• Финансовая система (баланс, выплаты): 1.5-3 часа
• Мультиплеер real-time (игры): 4-8 часов
• Видео-стриминг: 3-6 часов
• AI-рекомендательная система: 2-4 часа
• Сложная аналитика / дашборды: 2-4 часа

═══ ИНФРАСТРУКТУРА ═══

• Архитектура и настройка проекта (AI-скаффолдинг): 0.3-1 час
• Тестирование и отладка: +10-15% к сумме часов (AI пишет тесты)
• CI/CD настройка (автоматизация): 0.3-0.7 часа

═══ МНОЖИТЕЛИ ═══

• 3D/WebGL модули: x1.5 к часам (AI помогает меньше)
• Real-time мультиплеер: x1.3 к связанным модулям
• Мультиязычность (i18n): x1.05 (AI переводит мгновенно)
• GameDev механики (кастомные): x1.2
• Срочный проект: x1.2-1.4 ко всему
• Кастомный сложный дизайн: x1.1-1.2

═══ МАССОВЫЙ КОНТЕНТ (AI-ГЕНЕРАЦИЯ) ═══

AI генерирует массовый контент ПАКЕТАМИ, не поштучно!
• 100 ачивок: 0.5-1 час (всё сразу: промпт → AI генерит → проверка)
• 1000 товаров: 0.5-1.5 часа (AI заполняет БД)
• 50 страниц контента: 1-2 часа (AI пишет всё)

НЕ считай "за штуку" — AI делает массово!

═══ МИНИМАЛЬНЫЕ ПОРОГИ (С AI + ГОТОВЫЕ РЕШЕНИЯ) ═══

⚠️ ВАЖНО: +2 дня страховки на любой проект (правки, обсуждения, тесты).

С ГОТОВЫМИ БИБЛИОТЕКАМИ, UI-КИТАМИ И AI-ГЕНЕРАЦИЕЙ:
• Лендинг: от 0.5 часа → минимум 2 дня (с запасом)
• Корпоративный сайт: от 1-2 часов → минимум 2 дня
• Интернет-магазин: от 3-5 часов → 2 дня
• Веб-приложение (SaaS): от 3-5 часов → 2 дня
• Социальная сеть / Платформа: от 5-7 часов → 2-3 дня
• Маркетплейс (аналог ОЗОН/Wildberries): от 7-10 часов → 2-3 дня
• Игровая платформа: от 8-12 часов → 3-4 дня
• CRM / Админ-панель: от 2.5-4 часов → 2 дня
• Telegram бот: от 1-2 часа → 2 дня (минимум)
• Мобильное приложение: от 3-5 часов → 2 дня
• API / Backend: от 2-3 часа → 2 дня

══════════════════════════════════════
ФОРМУЛА РАСЧЁТА
══════════════════════════════════════

1. Разбей ТЗ на модули (ЕСЛИ КОРОТКОЕ — РАЗЛОЖИ САМ на основе справочника!)
2. Оцени часы каждого модуля С ГОТОВЫМИ РЕШЕНИЯМИ (таблица выше)
3. Сумма всех часов модулей
4. +10-15% на тестирование и отладку (AI пишет тесты, нужна проверка)
5. Общие часы ÷ 7 продуктивных часов = базовых дней
6. МИНИМУМ: +2 дня к любому результату (страховка на правки, тесты, обсуждения)
7. finalDays = Math.max(baseDays + 2, 2)
8. Стоимость = finalDays × 5000 рублей
9. Диапазон: ±20% для мин/макс

Дневная ставка: 5000 рублей.

══════════════════════════════════════
СРАВНЕНИЕ С ТРАДИЦИОННОЙ СТУДИЕЙ
══════════════════════════════════════

Традиционная студия (ручная разработка БЕЗ AI-агентов):
- Цена в 8-15 раз выше (команда, менеджмент, дизайнеры, тестировщики)
- Время в 15-30 раз дольше (ручной код, процессы, согласования)

Рассчитай studioComparison:
- priceMin/priceMax = твои цены × 8-15
- daysMin/daysMax = твои дни × 15-30

══════════════════════════════════════
ПРАВИЛА
══════════════════════════════════════

1. ГЛАВНОЕ: это AI-DRIVEN разработка. 90% работы делают AI-агенты + готовые решения.
2. **ИСТОЧНИК ПРАВДЫ = ОПИСАНИЕ/ТЗ.** Галочки и выборы из формы (тип проекта, функции, стек) — это ПОДСКАЗКИ, НЕ ТРЕБОВАНИЯ. Если в ТЗ написано иное — верь ТЗ.
3. КОРОТКОЕ описание → разворачивай в полный список модулей по типу проекта из справочника.
4. ТЗ противоречит типу → считай ПО ТЗ (оно главнее).
5. Считай ВСЕ модули из ТЗ, **НО ОБЪЕДИНЯЙ мелочи**: "Бот: меню + кнопки + воронка" = 1 модуль, НЕ 3.
6. Breakdown: 5-15 строк для среднего проекта. НЕ дроби на 30 мелких модулей.
7. РАСПАКОВЫВАЙ массовый контент (100 ачивок = посчитай общее время).
8. МИНИМУМ +2 дня к любому проекту (страховка).
9. Один разработчик с AI: 7 продуктивных часов/день.
10. Рекомендации ДЛЯ ЗАКАЗЧИКА (не технические): расходы, MVP, приёмка.
11. Сложность определяй САМ по ТЗ, не полагайся на выбор пользователя.
12. Тон нейтральный: "проект потребует", не "я сделаю".
13. **ФУНКЦИИ ИЗ ФОРМЫ (галочки) — ИГНОРИРУЙ, если они УЖЕ в ТЗ.** Не добавляй часы за то, что уже учтено.
14. РЕАЛИЗМ: Telegram-бот обычно 2-10 часов, лендинг 1-5 часов, админка 3-10 часов.`;

// ══════════════════════════════════════
// ══════════════════════════════════════
// API CALL — NVIDIA primary, Groq fallback
// ══════════════════════════════════════

async function callAI(messages: { role: string; content: string }[], maxTokens: number): Promise<string> {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA API ключ не настроен');
  }

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`[AI] Using NVIDIA Mistral Large 3, total chars: ${totalChars}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(PRIMARY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
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
      throw new Error('Модель вернула пустой ответ');
    }

    console.log('[AI] NVIDIA Mistral Large 3 success!');
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
    social: 'Социальная сеть / Платформа',
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

// Определяет тип проекта из короткого описания по ключевым словам
function detectTypeFromDescription(description: string): string | null {
  const lowerDesc = description.toLowerCase();
  for (const [keyword, type] of Object.entries(CLONE_KEYWORDS)) {
    if (lowerDesc.includes(keyword.toLowerCase())) {
      return type;
    }
  }
  return null;
}

function buildProjectContext(body: EstimateRequest, description: string, hasFullTZ: boolean, isSummarized?: boolean): string {
  const actualType = getTypeLabel(body.projectType, body.projectTypeCustom);
  const allFeatures = [...body.features, ...body.customFeatures];

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

  // Пытаемся определить "клон" из описания
  const detectedCloneType = detectTypeFromDescription(description);
  const cloneInfo = detectedCloneType && isShortDesc
    ? `\n🔍 В описании обнаружена ссылка на известный сервис. Тип: "${detectedCloneType}". Ты ОБЯЗАН оценить полную сложность этого типа проекта!\n`
    : '';

  return `Тип проекта: ${actualType}
${tzLabel}${shortDescWarning}${cloneInfo}

ОПИСАНИЕ/ТЗ:
${description}

Функции из формы (ПОДСКАЗКИ — учитывай ТОЛЬКО если НЕ описаны в ТЗ, не дублируй!): ${allFeatures.length > 0 ? allFeatures.join(', ') : 'не выбраны'}
Технологии: ${body.techStack.length > 0 ? body.techStack.join(', ') : 'на усмотрение разработчика'}
Дизайн (UI/UX): ${body.designNeeded ? 'нужен кастомный дизайн' : 'не нужен'}
Срочность: ${body.urgentDeadline ? 'СРОЧНЫЙ проект (множитель x1.3-1.5)' : 'стандартные сроки'}`;
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

  // Для коротких описаний — добавляем справочник типичных модулей
  const detectedCloneType = detectTypeFromDescription(description);
  const effectiveType = detectedCloneType || body.projectType;
  const referenceCatalog = PROJECT_REFERENCE_CATALOG[effectiveType];
  const isShortDesc = description.length < 500;

  let referenceSection = '';
  if (isShortDesc && referenceCatalog) {
    referenceSection = `\n\n📋 СПРАВОЧНИК ТИПИЧНЫХ МОДУЛЕЙ ДЛЯ "${referenceCatalog.label.toUpperCase()}":
${referenceCatalog.typicalModules.map(m => `  • ${m.name} (${m.hours}ч)`).join('\n')}
  Минимум по формуле: ${referenceCatalog.minHours} часов.
  Ты ОБЯЗАН раскрыть проект на эти (или аналогичные) модули, НЕ СОКРАЩАЯ.`;
  }

  const analysisPrompt = `Проанализируй проект и задай уточняющие вопросы для точной оценки стоимости.

${projectContext}${referenceSection}

ЗАДАЧА:
1. Определи реальную сложность проекта на основе содержания ТЗ/описания, ТИПА ПРОЕКТА и справочника модулей (если предоставлен).
2. Если описание КОРОТКОЕ — определи реальный масштаб по типу проекта. "Аналог ОЗОН" = enterprise-маркетплейс с AI (40-60+ часов базово), а не "простой магазин".
3. Определи реальный тип проекта — если ТЗ противоречит выбранному типу, укажи фактический тип.
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

  return NextResponse.json({
    questions: parsed.questions || [],
    detectedComplexity: parsed.detectedComplexity || 'средний',
    detectedType: parsed.detectedType || '',
    analysis: parsed.analysis || '',
    ...(isSummarized ? { filesAnalyzed: splitFiles(rawDesc).length } : {}),
  });
}

// ══════════════════════════════════════
// PHASE 2: Pricing
// ══════════════════════════════════════

async function handlePricingPhase(body: EstimateRequest, rawDesc: string): Promise<NextResponse> {
  const hasFullTZ = rawDesc.length > 5000;
  const { text: description, isSummarized } = await resolveDescription(rawDesc);
  const projectContext = buildProjectContext(body, description, hasFullTZ, isSummarized);

  // Для коротких описаний — добавляем справочник типичных модулей
  const detectedCloneType = detectTypeFromDescription(description);
  const effectiveType = detectedCloneType || body.projectType;
  const referenceCatalog = PROJECT_REFERENCE_CATALOG[effectiveType];
  const isShortDesc = description.length < 500;

  let referenceSection = '';
  if (isShortDesc && referenceCatalog) {
    referenceSection = `\n\n📋 СПРАВОЧНИК ТИПИЧНЫХ МОДУЛЕЙ ДЛЯ "${referenceCatalog.label.toUpperCase()}":
${referenceCatalog.typicalModules.map(m => `  • ${m.name} (${m.hours}ч)`).join('\n')}
  Минимум по формуле: ${referenceCatalog.minHours} часов.
  Ты ОБЯЗАН раскрыть проект на эти (или аналогичные) модули, НЕ СОКРАЩАЯ. Это ОБЯЗАТЕЛЬНЫЙ минимум.`;
  }

  // Build clarifications text from user answers
  let clarificationsText = '';
  if (body.clarifications && Object.keys(body.clarifications).length > 0) {
    clarificationsText = '\n\nУТОЧНЕНИЯ ОТ КЛИЕНТА:\n' +
      Object.entries(body.clarifications)
        .map(([q, a]) => `• ${q}: ${a}`)
        .join('\n');
  }

  const pricingPrompt = `Оцени стоимость проекта по формуле: часы модулей → дни × ставка.

${projectContext}${referenceSection}${clarificationsText}

⚠️ ВАЖНО:
- Сложность определяй САМ по содержанию ТЗ, ТИПА ПРОЕКТА и справочника модулей.
- Если описание КОРОТКОЕ и обнаружен "клон" известного сервиса — ИСПОЛЬЗУЙ справочник как основу breakdown.
- Если в ТЗ описан более сложный проект, чем выбран тип — переоценивай по ТЗ.
- Используй уточнения клиента для корректировки оценки.
- Каждый модуль = отдельная строка в breakdown с часами.
- РАСПАКОВЫВАЙ скрытую сложность: "100 ачивок" = не 1 строка, а расчёт по количеству.
- Добавь строку "Тестирование и отладка" = 25% от суммы часов остальных модулей.
- ФУНКЦИИ ИЗ ФОРМЫ — это подсказки. Если функция уже есть в ТЗ — НЕ считай её дважды.
- Минимальные пороги часов НЕ МОГУТ БЫТЬ ПРЕВЫШЕНЫ ВНИЗ: если тип проекта требует минимум 250ч — breakdown не может быть меньше.
${isSummarized ? '- ТЗ проанализировано пофайлово — собери модули из ВСЕХ файлов в единый breakdown!\n' : ''}
РАСЧЁТ (AI-DRIVEN С ГОТОВЫМИ РЕШЕНИЯМИ):
1. Суммируй часы всех модулей → базовые часы (БЕЗ тестирования)
2. Добавь тестирование: testingHours = базовые часы × 0.12
3. totalHours = базовые часы + testingHours
4. baseDays = Math.ceil(totalHours / 7)
5. ⚠️ ОБЯЗАТЕЛЬНО +2 дня страховки к baseDays
6. finalDays = baseDays + 2 (МИНИМУМ 2, если получилось меньше)
7. Стоимость = finalDays × 5000 рублей
8. priceMin = стоимость × 0.8, priceMax = стоимость × 1.2
9. daysMin = finalDays, daysMax = Math.ceil(finalDays × 1.2)
10. studioComparison: priceMin × 12, priceMax × 17, daysMin × 25, daysMax × 35

ПРИМЕР:
- Модули: 100 часов
- Тесты: 100 × 0.12 = 12 часов
- Всего: 112 часов
- baseDays: 112 ÷ 7 = 16 дней
- finalDays: 16 + 2 = 18 дней ← ЭТО ОТВЕТ, НЕ 16!
- Цена: 18 × 5000 = 90,000 руб

ОТВЕЧАЙ ТОЛЬКО JSON. ВСЕ текстовые значения — СТРОГО НА РУССКОМ ЯЗЫКЕ:
{
  "totalHours": число,
  "days": число,
  "dailyRate": 5000,
  "priceMin": число,
  "priceMax": число,
  "daysMin": число,
  "daysMax": число,
  "detectedComplexity": "простой|средний|сложный|enterprise",
  "breakdown": [{"category": "название модуля", "hours": часы}],
  "studioComparison": {"priceMin": число, "priceMax": число, "daysMin": число, "daysMax": число},
  "recommendations": ["рекомендация 1", "рекомендация 2", "..."]
}

ВАЖНО:
- **НЕ ДРОБИ мелочи!** Telegram-бот "меню + кнопки + обработчики + воронка" = 1-2 модуля, НЕ 10 мелких строк.
- **Объединяй связанное:** "Уведомления клиенту" вместо "Напоминание о записи", "SMS", "Push" отдельно.
- breakdown должен содержать 5-15 строк для среднего проекта, 15-25 для крупного
- Каждое число в breakdown.hours должно быть реалистичным для AI с готовыми решениями (см. таблицу)
- breakdown не может быть менее ${isShortDesc && referenceCatalog ? referenceCatalog.minHours : 0.5} часов (до тестирования)
- Добавь строку "Тестирование и отладка (AI)" в breakdown = 10-12% от суммы остальных
- ПОСЛЕ расчёта baseDays добавь +2 дня страховки: finalDays = baseDays + 2
- studioComparison считай от AI-цены: умножай на 12-17 по цене и 25-35 по времени
- recommendations — 3-5 советов ДЛЯ ЗАКАЗЧИКА (не для программиста!): скрытые расходы после запуска (хостинг, домен, подписки на сервисы), что сделать в первую очередь как MVP, а что можно отложить, что может увеличить итоговую цену, что проверить перед приёмкой работы. Простым языком, без технических терминов.`;

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
    return NextResponse.json(
      { error: 'Сервис временно недоступен. Попробуйте позже.', details: lastError?.message },
      { status: 503 }
    );
  }

  const jsonMatch = pricingResult.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Pricing JSON parse failed. Raw response:', pricingResult.slice(0, 500));
    return NextResponse.json(
      { error: 'Не удалось рассчитать. Попробуйте ещё раз.' },
      { status: 500 }
    );
  }

  let estimate: EstimateResponse;
  try {
    estimate = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Pricing JSON.parse failed:', e, 'Extracted:', jsonMatch[0].slice(0, 300));
    return NextResponse.json(
      { error: 'Модель вернула некорректный ответ при расчёте. Попробуйте ещё раз.' },
      { status: 500 }
    );
  }

  if (!estimate.dailyRate) estimate.dailyRate = DAILY_RATE;

  // Защита: если модель вернула breakdown ниже минимального порога
  if (isShortDesc && referenceCatalog) {
    const breakdownTotal = estimate.breakdown.reduce((sum, b) => sum + b.hours, 0);
    if (breakdownTotal < referenceCatalog.minHours) {
      console.warn(
        `[Guard] Breakdown ${breakdownTotal}h is below minimum ${referenceCatalog.minHours}h for "${referenceCatalog.label}". ` +
        `Using reference catalog as fallback.`
      );
      estimate.breakdown = referenceCatalog.typicalModules.map(m => ({
        category: m.name,
        hours: m.hours,
      }));
      // Пересчитываем totalHours с тестированием 10-12% (берём 12%)
      const modulesTotal = estimate.breakdown.reduce((sum, b) => sum + b.hours, 0);
      const testingHours = Math.ceil(modulesTotal * 0.12);
      estimate.breakdown.push({ category: 'Тестирование и отладка (AI)', hours: testingHours });
      estimate.totalHours = modulesTotal + testingHours;

      // +2 дня страховка
      const baseDays = Math.ceil(estimate.totalHours / 7);
      estimate.days = Math.max(baseDays + 2, 2);

      const cost = estimate.days * DAILY_RATE;
      estimate.priceMin = Math.round(cost * 0.8);
      estimate.priceMax = Math.round(cost * 1.2);
      estimate.daysMin = estimate.days;
      estimate.daysMax = Math.ceil(estimate.days * 1.2);

      // Сравнение со студией: x12 по цене, x25 по времени
      estimate.studioComparison = {
        priceMin: Math.round(estimate.priceMin * 12),
        priceMax: Math.round(estimate.priceMax * 17),
        daysMin: Math.round(estimate.daysMin * 25),
        daysMax: Math.round(estimate.daysMax * 35),
      };
    }
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
