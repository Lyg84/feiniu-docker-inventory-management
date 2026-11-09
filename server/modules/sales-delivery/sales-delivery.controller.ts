import { Controller, Get, Post, Put, Delete, Query, Param, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { SalesDeliveryService } from './sales-delivery.service';
import type { SalesDelivery, PageResult } from '@shared/api.interface';

@Controller('api/sales-deliveries')
export class SalesDeliveryController {
  constructor(private readonly service: SalesDeliveryService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('customerId') customerId?: string,
    @Query('auditStatus') auditStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<SalesDelivery>> {
    return this.service.list({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      keyword,
      customerId,
      auditStatus,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<SalesDelivery> {
    return this.service.get(id);
  }

  @NeedLogin()
  @Post()
  async create(@Body() body: any): Promise<SalesDelivery> {
    return this.service.create(body);
  }

  @NeedLogin()
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any): Promise<SalesDelivery> {
    return this.service.update(id, body);
  }

  @NeedLogin()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }

  @NeedLogin()
  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<SalesDelivery> {
    return this.service.audit(id);
  }

  @NeedLogin()
  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<SalesDelivery> {
    return this.service.unaudit(id);
  }

  @NeedLogin()
  @Post(':id/print-mark')
  async markPrinted(@Param('id') id: string): Promise<SalesDelivery> {
    return this.service.markPrinted(id);
  }

  @NeedLogin()
  @Post('batch-mark-return')
  @HttpCode(HttpStatus.NO_CONTENT)
  async batchMarkReturn(@Body() body: { ids: string[] }): Promise<void> {
    await this.service.batchMarkReturn(body.ids);
  }
}
