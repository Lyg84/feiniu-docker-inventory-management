import { Controller, Get, Query } from '@nestjs/common';
import { SysLogService } from './sys-log.service';
import type { SysLog, PageResult } from '@shared/api.interface';

@Controller('api/sys-logs')
export class SysLogController {
  constructor(private readonly sysLogService: SysLogService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<SysLog>> {
    return this.sysLogService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }
}
