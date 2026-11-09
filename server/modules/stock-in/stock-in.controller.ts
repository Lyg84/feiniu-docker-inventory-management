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
import { StockInService } from './stock-in.service';
import type { StockIn, PageResult } from '@shared/api.interface';

@Controller('api/stock-ins')
export class StockInController {
  constructor(private readonly stockInService: StockInService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<StockIn>> {
    return this.stockInService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      status,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<StockIn> {
    return this.stockInService.get(id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<StockIn> {
    return this.stockInService.create(body as Record<string, unknown>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<StockIn> {
    return this.stockInService.update(id, body as Record<string, unknown>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.stockInService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<StockIn> {
    return this.stockInService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<StockIn> {
    return this.stockInService.unaudit(id);
  }
}
