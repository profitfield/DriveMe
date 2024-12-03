// src/modules/drivers.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../entities/driver.entity';
import { Order } from '../entities/order.entity';
import { DriversService } from '../services/drivers.service';
import { DriversController } from '../controllers/drivers.controller';
import { AssignmentModule } from './assignment/assignment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Order]),
    AssignmentModule
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService]
})
export class DriversModule {}