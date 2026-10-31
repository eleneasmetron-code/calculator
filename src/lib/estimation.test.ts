import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { normalizeEstimate, TECH_RESERVE_RUB, SCHEDULE_BUFFER_DAYS, MIN_WORKING_DAYS } from './estimation';

// ══════════════════════════════════════════════════════════════════════
// Базовые правила: техрезерв, буфер, минимальный срок
// ══════════════════════════════════════════════════════════════════════

test('любой расчёт включает техрезерв ≥ 10 000 ₽ и буфер 3 дня', () => {
  const estimate = normalizeEstimate({
    projectType: 'custom',
    description: 'Небольшой сервис',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  assert.equal(estimate.techReserve, TECH_RESERVE_RUB);
  assert.ok(estimate.techReserve >= 10_000);
  assert.equal(estimate.bufferDays, SCHEDULE_BUFFER_DAYS);
  assert.equal(estimate.bufferDays, 3);
  assert.ok(estimate.daysMin >= MIN_WORKING_DAYS, 'минимум 3 дня');
});

test('телеграм-бот: разработка за час, но срок = минимум 3 дня + буфер', () => {
  const estimate = normalizeEstimate({
    projectType: 'telegram',
    description: 'Простой телеграм-бот: принимает заявки и отправляет их менеджеру',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  assert.equal(estimate.detectedType, 'telegram');
  // Такой бот делается за час — поэтому срок держит буфер и минимум
  assert.ok(estimate.developmentDays <= 1.5, `чистая разработка короткая: ${estimate.developmentDays}`);
  assert.equal(estimate.bufferDays, SCHEDULE_BUFFER_DAYS);
  assert.ok(estimate.daysMin >= MIN_WORKING_DAYS, `минимум 3 дня: ${estimate.daysMin}`);
  assert.ok(estimate.daysMin <= 5, `но не больше недели: ${estimate.daysMin}`);
  // 5 000 ₽ — это работа, но техрезерв 10 000 ₽ превращает чек в ~20 000 ₽
  assert.ok(estimate.priceMin >= 20_000, `цена бота: ${estimate.priceMin}`);
  assert.ok(estimate.priceMin < 60_000, `бот не должен стоить как платформа: ${estimate.priceMin}`);
});

test('в цену всегда входят техрезерв и буфер по срокам', () => {
  const estimate = normalizeEstimate({
    projectType: 'telegram',
    description: 'Телеграм-бот для записи на консультацию',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  assert.equal(estimate.techReserve, 10_000);
  assert.ok(estimate.priceMin >= estimate.techReserve * 2, 'техрезерв + работа');
  assert.ok(
    estimate.guardrailsApplied.some(item => item.includes('технический резерв')),
    'техрезерв объяснён пользователю',
  );
  assert.ok(
    estimate.guardrailsApplied.some(item => item.includes('буфер')),
    'буфер по срокам объяснён пользователю',
  );
});

test('сайт-визитка: ориентир ~30 000 ₽', () => {
  const estimate = normalizeEstimate({
    projectType: 'landing',
    description: 'Сайт-визитка: одна страница, описание услуг, форма заявки, адаптив',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  assert.ok(estimate.priceMin >= 30_000, `цена визитки: ${estimate.priceMin}`);
  assert.ok(estimate.priceMin <= 90_000, `визитка не должна стоить как магазин: ${estimate.priceMin}`);
  assert.ok(estimate.daysMin >= 3);
});

// ══════════════════════════════════════════════════════════════════════
// Главный кейс: соцсеть по большому ТЗ
// ══════════════════════════════════════════════════════════════════════

const LAPNET_TZ = `Автомобильная социальная сеть LapNet.
Социальные профили и сообщества, полноценная новостная лента, фотографии и видео,
короткие вертикальные видео Laps, личные сообщения, групповые чаты, форумы, комментарии,
автомобильные профили, личный кабинет владельца, история владения автомобилями,
журнал эксплуатации и технического обслуживания реального автомобиля,
ИИ-ассистент по автомобилю, поломкам, запчастям и обслуживанию,
рейтинг водительских навыков NOMAD Driver Score, автомобильные клубы, мероприятия,
авто рынок с расширенным и ИИ-поиском автомобилей, партнёрские магазины запчастей,
проверка чеков после покупок у партнёров, система репутации,
еженедельные рейтинги активности, рекламная платформа.
Регистрация через номер телефона, email и Telegram, подтверждение телефона,
защита от массовой регистрации, восстановление доступа, активные сессии,
модерация, жалобы, админ-панель, уведомления, адаптивный интерфейс.
Высокая нагрузка, федеральный масштаб, отказоустойчивость, кэширование, мониторинг.`;

test('соцсеть по ТЗ: не меньше 500 000 ₽ и около недели, а не копейки', () => {
  const estimate = normalizeEstimate({
    projectType: 'social',
    description: LAPNET_TZ,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный', detectedType: 'social', recommendations: [] },
  });

  assert.equal(estimate.detectedType, 'social');
  assert.ok(
    estimate.priceMin >= 500_000,
    `соцсеть должна стоить от 500 000 ₽, получено ${estimate.priceMin}`,
  );
  assert.ok(
    estimate.priceMin <= 1_200_000,
    `но не как студия, получено ${estimate.priceMin}`,
  );
  assert.ok(
    estimate.daysMin >= 6 && estimate.daysMin <= 12,
    `срок около недели, получено ${estimate.daysMin}`,
  );
  assert.ok(estimate.modulesCount >= 14, `модулей найдено: ${estimate.modulesCount}`);

  // Сравнение с обычным разработчиком/студией должно быть существенно выше
  assert.ok(estimate.comparable.priceMin > estimate.priceMin * 1.5);
  assert.ok(estimate.comparable.daysMin > estimate.daysMin);
});

test('кнопка типа не влияет на цену: ТЗ определяет объём', () => {
  const build = (projectType: string) => normalizeEstimate({
    projectType,
    description: LAPNET_TZ,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный', detectedType: 'social', recommendations: [] },
  });

  const asSocial = build('social');
  const asLanding = build('landing');
  const asBot = build('telegram');

  assert.equal(asLanding.priceMin, asSocial.priceMin, 'лендинг-кнопка не удешевляет ТЗ');
  assert.equal(asBot.priceMin, asSocial.priceMin, 'кнопка «бот» не удешевляет ТЗ');
  assert.equal(asBot.modulesCount, asSocial.modulesCount);
});

// ══════════════════════════════════════════════════════════════════════
// Что НЕ входит в цену
// ══════════════════════════════════════════════════════════════════════

test('тип формы не меняет цену при отсутствии типа от ИИ или неподтверждённой соцсети', () => {
  for (const modelEstimate of [{}, { detectedType: 'social' }]) {
    const estimates = ['landing', 'game', 'crm', 'telegram', 'custom'].map(projectType =>
      normalizeEstimate({
        projectType,
        description: 'Сервис записи к мастерам: заявки, расписание, подбор исполнителя и кабинет оператора.',
        designNeeded: false,
        urgentDeadline: false,
        modelEstimate,
      }),
    );
    for (const estimate of estimates) {
      assert.equal(estimate.priceMin, estimates[0].priceMin);
      assert.equal(estimate.priceMax, estimates[0].priceMax);
      assert.equal(estimate.modulesCount, estimates[0].modulesCount);
      assert.equal(estimate.detectedType, estimates[0].detectedType);
    }
  }
});

test('подключение платных сервисов не входит в цену, но честно называется', () => {
  const estimate = normalizeEstimate({
    projectType: 'ecommerce',
    description: 'Интернет-магазин с онлайн-оплатой картой, SMS-уведомлениями и картой пунктов выдачи',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  assert.ok(estimate.excludedFromPrice.length >= 2, 'перечислены сервисы вне разработки');
  assert.ok(
    estimate.excludedFromPrice.some(item => item.includes('онлайн-оплата')),
    'онлайн-оплата помечена как отдельная работа',
  );
  assert.ok(estimate.excludedFromPrice.some(item => item.includes('SMS')));
  assert.ok(estimate.excludedFromPrice.some(item => item.includes('карты')));
});

// ══════════════════════════════════════════════════════════════════════
// Дополнительные функции и дизайн усиливают смету
// ══════════════════════════════════════════════════════════════════════

test('выбранные функции добавляют модули к смете', () => {
  const base = normalizeEstimate({
    projectType: 'crm',
    description: 'CRM для отдела продаж: клиенты, сделки, задачи, отчёты, роли',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  const extended = normalizeEstimate({
    projectType: 'crm',
    description: 'CRM для отдела продаж: клиенты, сделки, задачи, отчёты, роли',
    designNeeded: true,
    urgentDeadline: false,
    features: ['Админ-панель', 'Оплата онлайн', 'Аналитика / Графики', 'Push-уведомления'],
    modelEstimate: {},
  });

  assert.ok(extended.modulesCount > base.modulesCount, 'доп. функции — это отдельные модули');
  assert.ok(extended.modulesPrice > base.modulesPrice, 'и они оплачиваются');
  assert.ok(extended.techReserve >= 10_000);
});

test('дизайн добавляет модуль дизайна', () => {
  const without = normalizeEstimate({
    projectType: 'webapp',
    description: 'Сервис учёта заявок для небольшой компании',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });
  const withDesign = normalizeEstimate({
    projectType: 'webapp',
    description: 'Сервис учёта заявок для небольшой компании',
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: {},
  });

  assert.ok(withDesign.modulesCount > without.modulesCount);
  assert.ok(withDesign.modulesPrice > without.modulesPrice, 'дизайн — отдельный оплачиваемый модуль');
  assert.ok(withDesign.priceMin >= without.priceMin);
});

// ══════════════════════════════════════════════════════════════════════
// Срочность
// ══════════════════════════════════════════════════════════════════════

test('срочный проект дороже, срок не уменьшается', () => {
  const build = (urgent: boolean) => normalizeEstimate({
    projectType: 'webapp',
    description: 'Веб-приложение для управления складом: товары, остатки, заказы, отчёты, интеграция с 1С',
    designNeeded: false,
    urgentDeadline: urgent,
    modelEstimate: {},
  });

  const normal = build(false);
  const urgent = build(true);

  assert.ok(urgent.urgencySurcharge > 0);
  assert.ok(urgent.priceMin > normal.priceMin);
  assert.ok(urgent.priceMin <= Math.ceil(normal.priceMin * 1.3));
  assert.equal(urgent.daysMin, normal.daysMin);
});

// ══════════════════════════════════════════════════════════════════════
// Модули от ИИ
// ══════════════════════════════════════════════════════════════════════

test('модули от ИИ добавляют объём, но не дублируют каталог', () => {
  const description = 'Сервис аренды инструментов между соседями: объявления, бронирование, отзывы, рейтинг, чат.';

  const withoutAi = normalizeEstimate({
    projectType: 'marketplace',
    description,
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {},
  });

  const withAi = normalizeEstimate({
    projectType: 'marketplace',
    description,
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {
      modules: [
        { name: 'Чат между арендодателем и арендатором' }, // уже есть в каталоге
        { name: 'Управление залогами и депозитами' },      // новое
        { name: 'Тестирование и деплой' },                 // запрещено
      ],
    },
  });

  assert.ok(withAi.modulesCount > withoutAi.modulesCount, 'но вымышленный модуль не добавлен');
  assert.ok(withAi.priceMin >= withoutAi.priceMin);
  const names = withAi.breakdown.map(item => item.category.toLowerCase()).join(' | ');
  assert.ok(!names.includes('тестирование и деплой'), 'технический этап не стал модулем');
});

// ══════════════════════════════════════════════════════════════════════
// Полнота таблицы и объяснений
// ══════════════════════════════════════════════════════════════════════

test('в смете у каждого модуля есть цена, а у итога — объяснение', () => {
  const estimate = normalizeEstimate({
    projectType: 'social',
    description: LAPNET_TZ,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный', detectedType: 'social' },
  });

  const paidModules = estimate.breakdown.filter(item => item.price && item.price > 0);
  assert.equal(paidModules.length, estimate.modulesCount, 'каждый модуль с ценой');
  assert.equal(
    paidModules.reduce((sum, item) => sum + (item.price || 0), 0),
    estimate.modulesPrice,
  );
  assert.ok(estimate.estimationBasis.includes('модул'));
  assert.ok(estimate.estimationBasis.includes('формат'));
  assert.ok(estimate.priceMax >= estimate.priceMin);
  assert.ok(estimate.daysMax >= estimate.daysMin);
});

// ══════════════════════════════════════════════════════════════════════
// Реальное ТЗ (если файл доступен рядом с проектом)
// ══════════════════════════════════════════════════════════════════════

test('реальное ТЗ LapNet: цена от 500 000 ₽ и срок около недели', () => {
  const candidates = [
    'TZ(3).md',
    'TZ.md',
    'tz.md',
  ];
  const path = candidates.find(candidate => existsSync(candidate));
  if (!path) return; // ТЗ нет — проверка пропускается

  const tz = readFileSync(path, 'utf-8');
  const estimate = normalizeEstimate({
    projectType: 'social',
    description: tz,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный' },
  });

  assert.equal(estimate.detectedType, 'social', `тип по ТЗ: ${estimate.detectedType}`);
  assert.ok(estimate.priceMin >= 500_000, `цена по реальному ТЗ: ${estimate.priceMin}`);
  assert.ok(estimate.daysMin >= 6 && estimate.daysMin <= 14, `срок по реальному ТЗ: ${estimate.daysMin}`);
  assert.ok(estimate.modulesCount >= 15, `модулей по реальному ТЗ: ${estimate.modulesCount}`);
  assert.ok(estimate.comparable.priceMin > estimate.priceMin * 1.5);
});

test('кнопка «Своё / Другое»: тип разбирается по тексту ТЗ', () => {
  const tz = readFileSync('TZ(3).md', 'utf-8');
  const estimate = normalizeEstimate({
    projectType: 'custom',
    description: tz,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный' },
  });

  assert.equal(estimate.detectedType, 'social', 'в ТЗ есть лента, подписки и сообщества');
  assert.ok(estimate.priceMin >= 500_000);
});
