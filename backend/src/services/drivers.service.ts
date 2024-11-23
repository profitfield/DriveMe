import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus, CarClass } from '../entities/driver.entity';
import { CreateDriverDto } from '../dto/driver.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private driversRepository: Repository<Driver>,
  ) {}

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    const driver = this.driversRepository.create(createDriverDto);
    return this.driversRepository.save(driver);
  }

  async findById(id: string): Promise<Driver> {
    const driver = await this.driversRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    
    return driver;
  }

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const driver = await this.findById(id);
    driver.status = status;
    return this.driversRepository.save(driver);
  }

  async getAvailableDrivers(carClass: CarClass): Promise<Driver[]> {
    return this.driversRepository.find({
      where: {
        carClass: carClass as CarClass, // явное приведение типа
        status: DriverStatus.ONLINE,
      },
      relations: ['user'],
    });
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    return this.driversRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async getActiveDrivers(): Promise<Driver[]> {
    return this.driversRepository.find({
      where: [
        { status: DriverStatus.ONLINE },
        { status: DriverStatus.BUSY }
      ],
      relations: ['user'],
    });
  }

  async updateDriverRating(id: string, rating: number): Promise<Driver> {
    const driver = await this.findById(id);
    driver.rating = (driver.rating * driver.totalRides + rating) / (driver.totalRides + 1);
    driver.totalRides += 1;
    return this.driversRepository.save(driver);
  }
}