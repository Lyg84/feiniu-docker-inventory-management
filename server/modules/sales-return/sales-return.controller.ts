import { Controller, Get, Post, Put, Delete, Query, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { SalesReturnService } from './sales-return.service';
import type { SalesReturn, PageResult } from '@shared/api.interface';

@Controller('api/sales-returns')
export class SalesReturnController {
  constructor(private readonly service: SalesReturnService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('customerId') customerId?: string,
    @Query('auditStatus') auditStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<SalesReturn>> {
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
  async get(@Param('id') id: string): Promise<SalesReturn> {
    return this.service.get(id);
  }

  @NeedLogin()
  @Post()
  async create(@Body() body: any): Promise<SalesReturn> {
    return this.service.create(body);
  }

  @NeedLogin()
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any): Promise<SalesReturn> {
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
  async audit(@Param('id') id: string): Promise<SalesReturn> {
    return this.service.audit(id);
  }

  @NeedLogin()
  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<SalesReturn> {
    return this.service.unaudit(id);
  }
}
