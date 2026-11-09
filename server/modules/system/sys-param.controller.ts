import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { SysParamService } from './sys-param.service';
import type { SysParam } from '@shared/api.interface';

@Controller('api/sys-params')
export class SysParamController {
  constructor(private readonly sysParamService: SysParamService) {}

  @Get()
  async list(): Promise<SysParam[]> {
    return this.sysParamService.list();
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<{ paramKey: string; paramValue: string; paramName: string; remark: string }>): Promise<SysParam> {
    return this.sysParamService.update(id, body);
  }
}
