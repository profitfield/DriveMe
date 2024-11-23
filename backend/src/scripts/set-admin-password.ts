import { createConnection } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../entities/admin-user.entity';
import { config } from 'dotenv';

config();

async function setAdminPassword() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [AdminUser],
    synchronize: false
  });

  const adminRepository = connection.getRepository(AdminUser);
  
  // Генерируем безопасный пароль или используем заданный
  const newPassword = 'Admin123!@#'; // В продакшене нужно сгенерировать случайный пароль
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await adminRepository.update(
    { email: 'admin@driveme.com' },
    { password: hashedPassword }
  );

  console.log('Admin password has been set to:', newPassword);
  console.log('Please change this password after first login!');

  await connection.close();
}

setAdminPassword().catch(error => {
  console.error('Error setting admin password:', error);
  process.exit(1);
});