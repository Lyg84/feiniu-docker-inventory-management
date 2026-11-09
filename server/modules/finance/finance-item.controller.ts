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
import { FinanceItemService } from './finance-item.service';
import type { FinanceItem } from '@shared/api.interface';

@Controller('api/finance-items')
export class FinanceItemController {
  constructor(private readonly financeItemService: FinanceItemService) {}

  @Get()
  async list(@Query('type') type?: string): Promise<FinanceItem[]> {
    return this.financeItemService.list(type);
  }

  @Post()
  async create(
    @Body() body: Partial<FinanceItem> & { name: string; type: string },
  ): Promise<FinanceItem> {
    return this.financeItemService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<FinanceItem>,
  ): Promise<FinanceItem> {
    return this.financeItemService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.financeItemService.remove(id);
  }
}
