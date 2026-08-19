import assert from 'node:assert/strict';
import test from 'node:test';
import { getEstimationGuardrails, normalizeEstimate } from './estimation';

test('full Ozon analogue: price driven by T_Z modules, not by button', () => {
  const estimate = normalizeEstimate({
    projectType: 'custom',
    description: 'Сделать фулстак проект "аналог ОЗОН маркетплейса"',
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: {
      detectedComplexity: 'средний',
      breakdown: [
        { category: 'Интерфейс', hours: 30 },
        { category: 'Backend', hours: 40 },
        { category: 'Интеграции', hours: 20 },
        { category: 'Тестирование', hours: 10 },
      ],
      recommendations: [],
    },
  });

  assert.equal(estimate.detectedComplexity, 'enterprise');
  assert.ok(estimate.baseHours >= 280);
  assert.ok(estimate.testingPercent >= 28);
  assert.ok(estimate.priceMin > 100_000, 'цена выше 100k');
  assert.ok(estimate.daysMin >= 5);
  assert.ok(estimate.daysMax <= 7);
  assert.ok(estimate.guardrailsApplied.length > 0);
});

test('marketplace profile has an enterprise floor even without a famous brand', () => {
  const guardrails = getEstimationGuardrails({
    projectType: 'marketplace',
    description: 'Маркетплейс для продавцов и покупателей с оплатой и доставкой',
    designNeeded: false,
  });

  assert.equal(guardrails.complexityFloor, 'enterprise');
  assert.ok(guardrails.requiredBaseHours >= 220);
  assert.ok(guardrails.minimumWorkingDays >= 5);
});

test('explicit Ozon MVP is smaller than a full analogue but still substantial', () => {
  const full = getEstimationGuardrails({
    projectType: 'custom',
    description: 'Полный аналог Ozon со всем функционалом',
    designNeeded: false,
  });
  const mvp = getEstimationGuardrails({
    projectType: 'custom',
    description: 'MVP аналога Ozon: базовый каталог, заказ и кабинет продавца',
    designNeeded: false,
  });

  assert.ok(mvp.requiredBaseHours < full.requiredBaseHours);
  assert.ok(mvp.requiredBaseHours >= 220);
  assert.ok(mvp.minimumWorkingDays >= 5);
  assert.ok(mvp.minimumWorkingDays < full.minimumWorkingDays);
});

test('NOMAD project: same price regardless of button, driven by T_Z', () => {
  // Длинное описание с ключевыми словами — детерминированный парсер находит модули
  const nomadDescription = [
    'Образовательная платформа для автошколы.',
    'Telegram-бот для записи на курсы, оплаты и напоминаний.',
    'Лендинг с кастомным дизайном, описанием курсов и формой записи.',
    'Админ-панель для управления курсами, расписанием, клиентами и отчётами.',
    'Мобильное приложение для студентов (каталог курсов, расписание, уведомления, профиль).',
    'Backend API для всех компонентов, база данных PostgreSQL.',
    'Интеграция с платёжным шлюзом, email и SMS сервисами.',
  ].join(' ');

  const custom = normalizeEstimate({
    projectType: 'custom',
    description: nomadDescription,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный', breakdown: [], recommendations: [] },
  });

  const telegram = normalizeEstimate({
    projectType: 'telegram',
    description: nomadDescription,
    designNeeded: true,
    urgentDeadline: false,
    modelEstimate: { detectedComplexity: 'сложный', breakdown: [], recommendations: [] },
  });

  // Цена ОДИНАКОВАЯ при любом выборе кнопки — ТЗ определяет цену
  assert.equal(custom.priceMin, telegram.priceMin, 'цена Min совпадает');
  assert.equal(custom.priceMax, telegram.priceMax, 'цена Max совпадает');
  // Сроки в коридоре
  assert.ok(telegram.daysMin >= 2);
  assert.ok(custom.daysMin >= 7);
  assert.ok(custom.daysMax <= 15);
});

test('a small landing: price above floor, days in corridor', () => {
  const estimate = normalizeEstimate({
    projectType: 'landing',
    description: 'Лендинг услуги с формой заявки, адаптивом и базовым SEO',
    designNeeded: false,
    urgentDeadline: false,
    modelEstimate: {
      detectedComplexity: 'простой',
      breakdown: [
        { category: 'Дизайн и верстка', hours: 8 },
        { category: 'Форма', hours: 2 },
      ],
      recommendations: [],
    },
  });

  assert.equal(estimate.detectedComplexity, 'простой');
  assert.ok(estimate.daysMin >= 2);
  assert.ok(estimate.daysMax <= 3);
  assert.ok(estimate.priceMin >= 30_000, 'цена выше пола');
});

test('urgent deadline adds ~25% multiplier without changing scope', () => {
  const build = (urgent: boolean) =>
    normalizeEstimate({
      projectType: 'custom',
      description: 'Индивидуальный проект из нескольких подсистем',
      designNeeded: false,
      urgentDeadline: urgent,
      modelEstimate: {
        detectedComplexity: 'средний',
        breakdown: [
          { category: 'Telegram-бот', hours: 30 },
          { category: 'Backend и API', hours: 30 },
          { category: 'Админ-панель', hours: 20 },
          { category: 'Лендинг', hours: 20 },
        ],
        recommendations: [],
      },
    });

  const normal = build(false);
  const urgent = build(true);

  assert.ok(urgent.priceMin > normal.priceMin, 'urgent должен стоить дороже');
  assert.ok(urgent.priceMin <= Math.ceil(normal.priceMin * 1.3));
  assert.equal(urgent.daysMin, normal.daysMin);
});

test('high-load requirements increase the deterministic floor', () => {
  const regular = getEstimationGuardrails({
    projectType: 'webapp',
    description: 'SaaS для управления задачами команды',
    designNeeded: false,
  });
  const highLoad = getEstimationGuardrails({
    projectType: 'webapp',
    description: 'SaaS для 100 000 пользователей с высокой нагрузкой',
    designNeeded: false,
  });

  assert.ok(highLoad.requiredBaseHours > regular.requiredBaseHours);
  assert.ok(highLoad.minimumWorkingDays > regular.minimumWorkingDays);
});
