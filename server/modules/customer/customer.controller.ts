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
import { CustomerService, type ImportResult } from './customer.service';
import type { Customer, PageResult } from '@shared/api.interface';

@Controller('api/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<Customer>> {
    return this.customerService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }

  @Get('all')
  async all(): Promise<Customer[]> {
    return this.customerService.all();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Customer> {
    return this.customerService.get(id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importMany(
    @Body() body: { rows?: Array<Partial<Customer> & { name?: string }> },
  ): Promise<ImportResult> {
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    return this.customerService.importMany(rows);
  }

  @Post()
  async create(@Body() body: Partial<Customer> & { name: string }): Promise<Customer> {
    return this.customerService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<Customer>,
  ): Promise<Customer> {
    return this.customerService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.customerService.remove(id);
  }
}
