#!/bin/bash

# Проверяем, установлен ли PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Installing..."
    brew install postgresql
    brew services start postgresql
    sleep 5  # Даем время PostgreSQL запуститься
fi

# Загружаем переменные окружения
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}')
fi

# Создаем пользователя и базу данных
psql postgres <<EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

# Проверяем результат
if [ $? -eq 0 ]; then
    echo "Database setup completed successfully!"
    echo "Now you can run: npm run migration:run"
else
    echo "Error setting up database"
    exit 1
fi