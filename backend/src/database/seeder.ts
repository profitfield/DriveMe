import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config';
import { seedInitialData } from './seeds/initial.seed';

async function runSeeds() {
  const dataSource = new DataSource({
    ...databaseConfig,
    type: 'postgres',
  } as any);

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

runSeeds()
  .then(() => {
    console.log('Seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });