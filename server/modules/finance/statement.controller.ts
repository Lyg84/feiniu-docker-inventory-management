import { Controller, Get, Query } from '@nestjs/common';
import { StatementService } from './statement.service';
import type { CustomerStatement } from '@shared/api.interface';

@Controller('api/statements')
export class StatementController {
  constructor(private readonly service: StatementService) {}

  @Get()
  async list(
    @Query('keyword') keyword?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CustomerStatement[]> {
    return this.service.list({ keyword, startDate, endDate });
  }

  @Get('customer')
  async getCustomer(
    @Query('customerId') customerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CustomerStatement> {
    return this.service.getCustomerStatement({ customerId, startDate, endDate });
  }
}
