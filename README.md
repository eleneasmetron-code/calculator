# Калькулятор стоимости проекта

Next.js-приложение с двухэтапной AI-оценкой: сначала модель уточняет требования, затем формирует декомпозицию. Итоговые часы, сроки и стоимость пересчитываются серверным алгоритмом с минимальными профилями масштаба.

## Локальный запуск

Требования:

- Node.js 20.9 или новее
- ключ `GROQ_API_KEY` и/или `NVIDIA_API_KEY` в `.env.local`

```env
GROQ_API_KEY=ваш_ключ
NVIDIA_API_KEY=ваш_ключ
```

Установка и запуск:

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.

Обычная команда использует Webpack, потому что Turbopack на некоторых конфигурациях Windows может падать с системной ошибкой записи `1450`. Для ручной проверки Turbopack оставлена команда:

```bash
npm run dev:turbo
```

## Проверки

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Production

```bash
npm run build
npm run start
```

Для Vercel добавьте серверные переменные `GROQ_API_KEY` и/или `NVIDIA_API_KEY` в настройках проекта.
