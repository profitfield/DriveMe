# DriveMe Backend (MVP)

## Описание
Бэкенд для сервиса заказа премиальных автомобилей с водителем.

## Требования
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

## Установка и запуск

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/driveme.git
cd driveme/backend
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
cp .env.example .env
```
Отредактируйте файл .env, указав необходимые значения.

4. Запустите PostgreSQL и Redis через Docker:
```bash
cd infrastructure/docker
docker-compose up -d
```

5. Примените миграции:
```bash
npm run migration:run
```

6. Заполните базу тестовыми данными:
```bash
npm run seed
```

7. Запустите приложение:
```bash
npm run start:dev
```

## Структура проекта
```
src/
├── config/          # Конфигурация приложения
├── controllers/     # Контроллеры
├── dto/            # Data Transfer Objects
├── entities/       # Сущности базы данных
├── filters/        # Фильтры исключений
├── guards/         # Guards для авторизации
├── interfaces/     # Интерфейсы
├── middleware/     # Middleware
├── modules/        # Модули приложения
├── services/       # Сервисы
└── validators/     # Валидаторы
```

## API Документация
После запуска сервера, Swagger документация доступна по адресу:
http://localhost:3000/api

## Основные функции MVP
- Авторизация через Telegram
- Заказ автомобилей:
  - Предварительный заказ
  - Почасовая аренда
  - Заказ в аэропорт
- Управление водителями
- Система расчета стоимости
- Чат между клиентом и водителем
- Уведомления через Telegram бота

## Telegram Бот
1. Создайте бота через @BotFather
2. Получите токен и добавьте его в .env:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_NAME=your_bot_name
```

## Тестирование
```bash
# unit тесты
npm run test

# e2e тесты
npm run test:e2e

# coverage
npm run test:cov
```

## Окружения
- `development`: для локальной разработки
- `test`: для запуска тестов
- `production`: для продакшена

## Полезные команды
```bash
# запуск приложения
npm run start:dev

# сборка приложения
npm run build

# запуск в продакшен режиме
npm run start:prod

# создание новой миграции
npm run migration:generate -- src/database/migrations/название-миграции

# применение миграций
npm run migration:run

# откат миграции
npm run migration:revert
```