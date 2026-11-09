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
import { SupplierService } from './supplier.service';
import type { Supplier, PageResult } from '@shared/api.interface';

@Controller('api/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<Supplier>> {
    return this.supplierService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }

  @Get('all')
  async all(): Promise<Supplier[]> {
    return this.supplierService.all();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Supplier> {
    return this.supplierService.get(id);
  }

  @Post()
  async create(@Body() body: Partial<Supplier> & { name: string }): Promise<Supplier> {
    return this.supplierService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<Supplier>,
  ): Promise<Supplier> {
    return this.supplierService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.supplierService.remove(id);
  }
}
