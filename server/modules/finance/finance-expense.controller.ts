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
import { FinanceExpenseService } from './finance-expense.service';
import type { FinanceExpense, PageResult } from '@shared/api.interface';

@Controller('api/finance-expenses')
export class FinanceExpenseController {
  constructor(
    private readonly financeExpenseService: FinanceExpenseService,
  ) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<FinanceExpense>> {
    return this.financeExpenseService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      status,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<FinanceExpense> {
    return this.financeExpenseService.get(id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<FinanceExpense> {
    return this.financeExpenseService.create(body as Record<string, unknown>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<FinanceExpense> {
    return this.financeExpenseService.update(id, body as Record<string, unknown>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.financeExpenseService.remove(id);
  }
}
