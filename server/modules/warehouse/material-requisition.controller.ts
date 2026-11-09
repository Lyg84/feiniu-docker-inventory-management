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
import { MaterialRequisitionService } from './material-requisition.service';
import type { MaterialRequisition, PageResult } from '@shared/api.interface';

@Controller('api/material-requisitions')
export class MaterialRequisitionController {
  constructor(
    private readonly materialRequisitionService: MaterialRequisitionService,
  ) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PageResult<MaterialRequisition>> {
    return this.materialRequisitionService.list(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      keyword,
      status,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<MaterialRequisition> {
    return this.materialRequisitionService.get(id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>): Promise<MaterialRequisition> {
    return this.materialRequisitionService.create(body as Record<string, unknown>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<MaterialRequisition> {
    return this.materialRequisitionService.update(id, body as Record<string, unknown>);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.materialRequisitionService.remove(id);
  }

  @Post(':id/audit')
  async audit(@Param('id') id: string): Promise<MaterialRequisition> {
    return this.materialRequisitionService.audit(id);
  }

  @Post(':id/unaudit')
  async unaudit(@Param('id') id: string): Promise<MaterialRequisition> {
    return this.materialRequisitionService.unaudit(id);
  }
}
