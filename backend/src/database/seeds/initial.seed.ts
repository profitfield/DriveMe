import { DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Driver } from '../../entities/driver.entity';
import { TEST_DRIVERS, TEST_CLIENTS } from './constants';

export async function seedInitialData(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const usersRepository = dataSource.getRepository(User);
    const driversRepository = dataSource.getRepository(Driver);

    // Создаем тестовых водителей
    for (const driverData of TEST_DRIVERS) {
      const { carClass, carInfo, status, rating, totalRides, ...userData } = driverData;
      
      // Создаем пользователя для водителя
      const user = await usersRepository.save(
        usersRepository.create(userData)
      );

      // Создаем водителя
      await driversRepository.save(
        driversRepository.create({
          user,
          carClass,
          carInfo,
          status,
          rating,
          totalRides,
          commissionBalance: 0
        })
      );

      console.log(`Created driver: ${userData.firstName} ${userData.lastName}`);
    }

    // Создаем тестовых клиентов
    for (const clientData of TEST_CLIENTS) {
      await usersRepository.save(
        usersRepository.create(clientData)
      );
      console.log(`Created client: ${clientData.firstName} ${clientData.lastName}`);
    }

    await queryRunner.commitTransaction();
    console.log('All test data has been successfully created');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Error while seeding data:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}