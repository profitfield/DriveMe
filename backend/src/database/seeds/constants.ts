import { CarClass, DriverStatus } from '../../entities/driver.entity';

export const TEST_DRIVERS = [
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
  },
  {
    telegramId: '100000003',
    username: 'driver3',
    firstName: 'Александр',
    lastName: 'Сидоров',
    phoneNumber: '+79001234569',
    carClass: CarClass.ELITE,
    carInfo: {
      model: 'Mercedes S-class W223',
      number: 'С003СС777',
      year: 2023,
      color: 'Black'
    },
    status: DriverStatus.ONLINE,
    rating: 5.0,
    totalRides: 89
  }
];

export const TEST_CLIENTS = [
  {
    telegramId: '200000001',
    username: 'client1',
    firstName: 'Михаил',
    lastName: 'Клиентов',
    phoneNumber: '+79009876543'
  },
  {
    telegramId: '200000002',
    username: 'client2',
    firstName: 'Анна',
    lastName: 'Заказова',
    phoneNumber: '+79009876544'
  }
];