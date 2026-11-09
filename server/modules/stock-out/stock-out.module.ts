import { Module } from '@nestjs/common';
import { StockOutController } from './stock-out.controller';
import { StockOutService } from './stock-out.service';

@Module({
  controllers: [StockOutController],
  providers: [StockOutService],
  exports: [StockOutService],
})
export class StockOutModule {}
