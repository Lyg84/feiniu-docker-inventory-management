import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type { Product, PageResult } from '@shared/api.interface';

@Controller('api/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<PageResult<Product>> {
    return this.inventoryService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      warehouseId,
    );
  }
}
