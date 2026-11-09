import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SysUserController } from './sys-user.controller';
import { SysUserService } from './sys-user.service';
import { SysLogController } from './sys-log.controller';
import { SysLogService } from './sys-log.service';
import { SysLogInterceptor } from './sys-log.interceptor';
import { SysParamController } from './sys-param.controller';
import { SysParamService } from './sys-param.service';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [
    SysUserController,
    SysLogController,
    SysParamController,
    EmployeeController,
    AuthController,
  ],
  providers: [
    SysUserService,
    SysLogService,
    SysParamService,
    EmployeeService,
    AuthService,
    { provide: APP_INTERCEPTOR, useClass: SysLogInterceptor },
  ],
  exports: [SysUserService, SysLogService, SysParamService, EmployeeService, AuthService],
})
export class SystemModule {}
