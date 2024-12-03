// src/database/seeder.ts

import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Driver, CarClass, DriverStatus } from '../entities/driver.entity';

const TEST_DRIVERS = [
  {
    telegramId: '100000001',
    username: 'driver1',
    firstName: 'Иван',
    lastName: 'Петров',
    phoneNumber: '+79001234567',
    carClass: CarClass.PREMIUM,
    carInfo: {
      model: 'Mercedes S-class W222',
      number: 'А001АА777',
      year: 2021,
      color: 'Black'
    },
    status: DriverStatus.ONLINE,
    rating: 4.9,
    totalRides: 156
  },
  {
    telegramId: '100000002',
    username: 'driver2',
    firstName: 'Петр',
    lastName: 'Иванов',
    phoneNumber: '+79001234568',
    carClass: CarClass.PREMIUM_LARGE,
    carInfo: {
      model: 'Mercedes V-class W447',
      number: 'В002ВВ777',
      year: 2022,
      color: 'Black'
    },
    status: DriverStatus.ONLINE,
    rating: 4.8,
    totalRides: 123
  }
];

async function seedInitialData(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const usersRepository = queryRunner.manager.getRepository(User);
    const driversRepository = queryRunner.manager.getRepository(Driver);

    // Создаем тестовых водителей
    for (const driverData of TEST_DRIVERS) {
      const { carClass, carInfo, status, rating, totalRides, ...userData } = driverData;
      
      // Создаем пользователя
      const user = await usersRepository.save(
        usersRepository.create({
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber
        })
      );

      // Создаем водителя
      const driver = driversRepository.create({
        user,
        carClass,
        carInfo,
        status,
        rating,
        totalRides,
        commissionBalance: 0
      });

      await driversRepository.save(driver);

      console.log(`Created driver: ${userData.firstName} ${userData.lastName}`);
    }

    await queryRunner.commitTransaction();
    console.log('Test data has been successfully created');

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Error while seeding data:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}

async function runSeeds() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'driveme_user',
    password: process.env.DB_PASSWORD || 'driveme_pass',
    database: process.env.DB_NAME || 'driveme',
    entities: [User, Driver],
    synchronize: false,
    logging: true
  });

  try {
    await dataSource.initialize();
    console.log('Database connection initialized');

    await seedInitialData(dataSource);
    console.log('Seeds executed successfully');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runSeeds().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});