import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { PurchaseIn, PageResult } from '@shared/api.interface';
import { PurchaseInService } from './purchase-in.service';

@Controller('api/purchase-ins')
export class PurchaseInController {
  constructor(private readonly purchaseInService: PurchaseInService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('supplierId') supplierId?: string,
    @Query('auditStatus') auditStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<PurchaseIn>> {
    return this.purchaseInService.list({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      keyword,
      supplierId,
      auditStatus,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PurchaseIn> {
    return this.purchaseInService.get(id);
  }

  @Post()
  async create(@Body() body: Partial<PurchaseIn>): Promise<PurchaseIn> {
    return this.purchaseInService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<PurchaseIn>,
  ): Promise<PurchaseIn> {
    return this.purchaseInService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.purchaseInService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<PurchaseIn> {
    return this.purchaseInService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<PurchaseIn> {
    return this.purchaseInService.unaudit(id);
  }
}
