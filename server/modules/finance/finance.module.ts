import { Module } from '@nestjs/common';
import { FinanceIncomeController } from './finance-income.controller';
import { FinanceIncomeService } from './finance-income.service';
import { FinanceExpenseController } from './finance-expense.controller';
import { FinanceExpenseService } from './finance-expense.service';
import { FinanceItemController } from './finance-item.controller';
import { FinanceItemService } from './finance-item.service';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';

@Module({
  controllers: [
    FinanceIncomeController,
    FinanceExpenseController,
    FinanceItemController,
    StatementController,
  ],
  providers: [
    FinanceIncomeService,
    FinanceExpenseService,
    FinanceItemService,
    StatementService,
  ],
  exports: [FinanceIncomeService, FinanceExpenseService, FinanceItemService, StatementService],
})
export class FinanceModule {}
