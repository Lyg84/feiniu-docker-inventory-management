import { Module } from '@nestjs/common';
import { PurchaseInController } from './purchase-in.controller';
import { PurchaseInService } from './purchase-in.service';

@Module({
  controllers: [PurchaseInController],
  providers: [PurchaseInService],
  exports: [PurchaseInService],
})
export class PurchaseInModule {}
