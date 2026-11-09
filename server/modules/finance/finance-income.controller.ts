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
import { FinanceIncomeService } from './finance-income.service';
import type { FinanceIncome, PageResult } from '@shared/api.interface';

@Controller('api/finance-incomes')
export class FinanceIncomeController {
  constructor(
    private readonly financeIncomeService: FinanceIncomeService,
  ) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<FinanceIncome>> {
    return this.financeIncomeService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      status,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<FinanceIncome> {
    return this.financeIncomeService.get(id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<FinanceIncome> {
    return this.financeIncomeService.create(body as Record<string, unknown>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<FinanceIncome> {
    return this.financeIncomeService.update(id, body as Record<string, unknown>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.financeIncomeService.remove(id);
  }
}
