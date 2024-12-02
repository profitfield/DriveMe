import { config } from 'dotenv';
import { join } from 'path';

// Загружаем тестовые переменные окружения
config({ path: join(__dirname, '../.env.test') });

// Глобальные настройки для тестов
global.console.error = jest.fn(); // Подавляем вывод ошибок в консоль при тестах