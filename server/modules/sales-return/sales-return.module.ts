import { Module } from '@nestjs/common';
import { SalesReturnController } from './sales-return.controller';
import { SalesReturnService } from './sales-return.service';

@Module({
  controllers: [SalesReturnController],
  providers: [SalesReturnService],
  exports: [SalesReturnService],
})
export class SalesReturnModule {}
