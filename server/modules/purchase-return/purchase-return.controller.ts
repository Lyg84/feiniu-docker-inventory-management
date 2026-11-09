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
} from '@nestjs/common';
import type { PurchaseReturn, PageResult } from '@shared/api.interface';
import { PurchaseReturnService } from './purchase-return.service';

@Controller('api/purchase-returns')
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('supplierId') supplierId?: string,
    @Query('auditStatus') auditStatus?: string,
  ): Promise<PageResult<PurchaseReturn>> {
    return this.purchaseReturnService.list({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      keyword,
      supplierId,
      auditStatus,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PurchaseReturn> {
    return this.purchaseReturnService.get(id);
  }

  @Post()
  async create(@Body() body: Partial<PurchaseReturn>): Promise<PurchaseReturn> {
    return this.purchaseReturnService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<PurchaseReturn>,
  ): Promise<PurchaseReturn> {
    return this.purchaseReturnService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.purchaseReturnService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<PurchaseReturn> {
    return this.purchaseReturnService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<PurchaseReturn> {
    return this.purchaseReturnService.unaudit(id);
  }
}
