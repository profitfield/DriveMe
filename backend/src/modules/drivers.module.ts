import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../entities/driver.entity';
import { Order } from '../entities/order.entity';
import { DriversService } from '../services/drivers.service';
import { DriversController } from '../controllers/drivers.controller';
import { OrdersModule } from './orders.module';
import { DriverAssignmentService } from '../services/driver-assignment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Order]), // Добавили Order в TypeOrmModule
    forwardRef(() => OrdersModule)
  ],
  controllers: [DriversController],
  providers: [DriversService, DriverAssignmentService],
  exports: [DriversService, DriverAssignmentService]
})
export class DriversModule {}