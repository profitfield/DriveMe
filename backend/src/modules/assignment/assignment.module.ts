// src/modules/assignment/assignment.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentService } from './assignment.service';
import { Driver } from '../../entities/driver.entity';
import { Order } from '../../entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Order])
  ],
  providers: [AssignmentService],
  exports: [AssignmentService]
})
export class AssignmentModule {}