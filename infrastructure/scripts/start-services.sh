#!/bin/bash

if [ ! -d "infrastructure/docker" ]; then
    echo "Создаем директорию infrastructure/docker..."
    mkdir -p infrastructure/docker
fi

cd infrastructure/docker || exit 1

if [ ! -f "docker-compose.yml" ]; then
    echo "Файл docker-compose.yml не найден. Пожалуйста, убедитесь, что он правильно настроен."
    exit 1
fi

if [ ! -f "../../.env" ]; then
    echo "Создаем файл .env..."
    cat > ../../.env << EOL
DB_NAME=driveme
DB_USER=driveme_user
DB_PASSWORD=driveme_pass
REDIS_HOST=localhost
REDIS_PORT=6379
EOL
    echo "Файл .env создан с базовыми настройками"
fi

echo "Запускаем сервисы..."
docker-compose up -d

echo "Ожидаем готовности сервисов..."
sleep 10

echo "Проверяем статус сервисов..."
docker-compose ps

echo "Настройка сервисов завершена!"