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
import { EmployeeService } from './employee.service';
import type { Employee, PageResult } from '@shared/api.interface';

@Controller('api/employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ): Promise<PageResult<Employee>> {
    return this.employeeService.list(parseInt(page, 10), parseInt(pageSize, 10), keyword);
  }

  @Get('all')
  async all(): Promise<Employee[]> {
    return this.employeeService.all();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Employee> {
    return this.employeeService.get(id);
  }

  @Post()
  async create(@Body() body: Partial<Employee> & { name: string }): Promise<Employee> {
    return this.employeeService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<Employee>,
  ): Promise<Employee> {
    return this.employeeService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.employeeService.remove(id);
  }
}
