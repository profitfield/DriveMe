#!/bin/bash

# Переходим в директорию backend
cd "$(dirname "$0")/.."

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    exit 1
fi

# Загружаем переменные окружения
source .env

# Проверяем подключение к базе данных
echo "Checking database connection..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c '\q' > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Cannot connect to database!"
    exit 1
fi

# Запускаем миграции
echo "Running migrations..."
npm run migration:run

if [ $? -eq 0 ]; then
    echo "Migrations completed successfully!"
else
    echo "Error during migration!"
    exit 1
fi