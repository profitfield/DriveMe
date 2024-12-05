import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { Driver } from '../entities/driver.entity';
import { Transaction } from '../entities/transaction.entity';
import { OrdersService } from '../services/orders.service';
import { OrderStatusService } from '../services/order-status.service';
import { OrdersController } from '../controllers/orders.controller';
import { DriverAssignmentService } from '../services/driver-assignment.service';
import { PriceService } from '../services/price.service';
import { TransactionService } from '../services/transaction.service';
import { NotificationModule } from './notification.module';
import { NotificationQueueService } from '../services/notification-queue.service';
import { WebSocketModule } from './websocket/websocket.module';
import { OrderGateway } from '../gateways/order.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Driver, Transaction]),
    NotificationModule,
    WebSocketModule
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderStatusService,
    DriverAssignmentService,
    PriceService,
    TransactionService,
    NotificationQueueService,
    OrderGateway
  ],
  exports: [
    OrdersService,
    OrderStatusService,
    DriverAssignmentService,
    PriceService,
    TransactionService
  ]
})
export class OrdersModule {}