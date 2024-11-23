import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { Driver } from '../entities/driver.entity';
import { OrdersService } from '../services/orders.service';
import { OrdersController } from '../controllers/orders.controller';
import { PriceService } from '../services/price.service';
import { DriversModule } from './drivers.module';
import { DriverAssignmentService } from '../services/driver-assignment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Driver]), // Добавили Driver в TypeOrmModule
    forwardRef(() => DriversModule)
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PriceService],
  exports: [OrdersService]
})
export class OrdersModule {}