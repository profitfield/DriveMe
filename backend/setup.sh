#!/bin/bash

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo ".env file created"
else
    echo ".env file already exists"
fi

# Устанавливаем зависимости
echo "Installing dependencies..."
npm install

# Запускаем миграции
echo "Running migrations..."
npm run migration:run

# Заполняем тестовые данные
echo "Seeding database..."
npm run seed

echo "Setup completed! You can now run 'npm run start:dev' to start the application"