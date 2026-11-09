import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StockOutService } from './stock-out.service';
import type { StockOut, PageResult } from '@shared/api.interface';

@Controller('api/stock-outs')
export class StockOutController {
  constructor(private readonly stockOutService: StockOutService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<StockOut>> {
    return this.stockOutService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      status,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<StockOut> {
    return this.stockOutService.get(id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<StockOut> {
    return this.stockOutService.create(body as Record<string, unknown>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<StockOut> {
    return this.stockOutService.update(id, body as Record<string, unknown>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.stockOutService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<StockOut> {
    return this.stockOutService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<StockOut> {
    return this.stockOutService.unaudit(id);
  }
}
