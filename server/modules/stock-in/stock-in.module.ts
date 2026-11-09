import { Module } from '@nestjs/common';
import { StockInController } from './stock-in.controller';
import { StockInService } from './stock-in.service';

@Module({
  controllers: [StockInController],
  providers: [StockInService],
  exports: [StockInService],
})
export class StockInModule {}
