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
import { MaterialReturnService } from './material-return.service';
import type { MaterialReturn, PageResult } from '@shared/api.interface';

@Controller('api/material-returns')
export class MaterialReturnController {
  constructor(
    private readonly materialReturnService: MaterialReturnService,
  ) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<MaterialReturn>> {
    return this.materialReturnService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      status,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<MaterialReturn> {
    return this.materialReturnService.get(id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<MaterialReturn> {
    return this.materialReturnService.create(body as Record<string, unknown>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<MaterialReturn> {
    return this.materialReturnService.update(id, body as Record<string, unknown>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.materialReturnService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<MaterialReturn> {
    return this.materialReturnService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<MaterialReturn> {
    return this.materialReturnService.unaudit(id);
  }
}
