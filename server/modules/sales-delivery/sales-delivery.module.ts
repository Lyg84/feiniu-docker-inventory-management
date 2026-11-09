import { Module } from '@nestjs/common';
import { SalesDeliveryController } from './sales-delivery.controller';
import { SalesDeliveryService } from './sales-delivery.service';

@Module({
  controllers: [SalesDeliveryController],
  providers: [SalesDeliveryService],
  exports: [SalesDeliveryService],
})
export class SalesDeliveryModule {}
