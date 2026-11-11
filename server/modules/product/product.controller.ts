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
import { ProductService, type ImportResult } from './product.service';
import type { Product, PageResult, PriceHistory } from '@shared/api.interface';

@Controller('api/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<Product>> {
    return this.productService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }

  @Get('all')
  async all(): Promise<Product[]> {
    return this.productService.all();
  }

  @Get('price-history')
  async priceHistory(
    @Query('productName') productName: string,
    @Query('customerId') customerId: string,
    @Query('spec') spec?: string,
  ): Promise<PriceHistory[]> {
    return this.productService.getPriceHistory(productName, customerId, spec);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Product> {
    return this.productService.get(id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importMany(
    @Body() body: { rows?: Array<Partial<Product> & { name?: string }> },
  ): Promise<ImportResult> {
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    return this.productService.importMany(rows);
  }

  @Post()
  async create(@Body() body: Partial<Product> & { name: string }): Promise<Product> {
    return this.productService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<Product>,
  ): Promise<Product> {
    return this.productService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.productService.remove(id);
  }
}
