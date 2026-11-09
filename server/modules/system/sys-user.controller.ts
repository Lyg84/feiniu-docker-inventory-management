import { Controller, Get, Post, Put, Delete, Query, Param, Body } from '@nestjs/common';
import { SysUserService } from './sys-user.service';
import type { SysUser, PageResult } from '@shared/api.interface';

@Controller('api/sys-users')
export class SysUserController {
  constructor(private readonly sysUserService: SysUserService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<SysUser>> {
    return this.sysUserService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<SysUser> {
    return this.sysUserService.get(id);
  }

  @Post()
  async create(@Body() body: { username: string; password: string; name?: string; role?: string; status?: string }): Promise<SysUser> {
    return this.sysUserService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<{ name: string; role: string; status: string; password: string }>): Promise<SysUser> {
    return this.sysUserService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.sysUserService.remove(id);
  }
}
