# DriveMe Backend (MVP)

## Описание
Бэкенд для сервиса заказа премиальных автомобилей с водителем.

## Требования
- Node.js 18+
- PostgreSQL 14+

## Установка и запуск

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/driveme.git
cd driveme/backend
```

2. Запустите скрипт установки:
```bash
chmod +x setup.sh
./setup.sh
```

Или выполните шаги вручную:

```bash
# Установка зависимостей
npm install

# Копирование .env файла
cp .env.example .env

# Запуск миграций
npm run migration:run

# Заполнение тестовых данных
npm run seed

# Запуск приложения
npm run start:dev
```

## API Документация
После запуска сервера, Swagger документация доступна по адресу:
http://localhost:3000/api

## Основные функции MVP
- Авторизация через Telegram
- Заказ автомобилей (предварительный, почасовой, в аэропорт)
- Управление водителями
- Расчет стоимости
- Чат между клиентом и водителем