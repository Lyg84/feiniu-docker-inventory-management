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
import type { Payment, PageResult } from '@shared/api.interface';
import { PaymentService } from './payment.service';

@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('supplierId') supplierId?: string,
    @Query('auditStatus') auditStatus?: string,
  ): Promise<PageResult<Payment>> {
    return this.paymentService.list({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      keyword,
      supplierId,
      auditStatus,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Payment> {
    return this.paymentService.get(id);
  }

  @Post()
  async create(@Body() body: Partial<Payment>): Promise<Payment> {
    return this.paymentService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<Payment>,
  ): Promise<Payment> {
    return this.paymentService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.paymentService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<Payment> {
    return this.paymentService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<Payment> {
    return this.paymentService.unaudit(id);
  }
}
