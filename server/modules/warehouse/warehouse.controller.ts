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
import { WarehouseService } from './warehouse.service';
import type { Warehouse, PageResult } from '@shared/api.interface';

@Controller('api/warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<Warehouse>> {
    return this.warehouseService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }

  @Get('all')
  async all(): Promise<Warehouse[]> {
    return this.warehouseService.all();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Warehouse> {
    return this.warehouseService.get(id);
  }

  @Post()
  async create(@Body() body: Partial<Warehouse> & { name: string }): Promise<Warehouse> {
    return this.warehouseService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<Warehouse>,
  ): Promise<Warehouse> {
    return this.warehouseService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.warehouseService.remove(id);
  }
}
