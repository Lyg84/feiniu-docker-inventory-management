/**
 * 本地平台模块汇总出口。
 * 业务代码的 import 统一从 '@lark-apaas/fullstack-nestjs-core' 改为 '@server/local'。
 */
export { DRIZZLE_DATABASE, LocalDatabaseModule } from './database';
export type { PostgresJsDatabase } from './database';
export { NeedLogin, NEED_LOGIN_KEY } from './need-login.decorator';
export { configureApp } from './app-config';

import { DynamicModule, Global, Module } from '@nestjs/common';
import { LocalDatabaseModule } from './database';

/**
 * 与平台包同名同形，兼容原有 PlatformModule.forRoot() 调用。
 */
@Global()
@Module({})
export class PlatformModule {
  static forRoot(): DynamicModule {
    return {
      module: PlatformModule,
      global: true,
      imports: [LocalDatabaseModule],
      exports: [LocalDatabaseModule],
    };
  }
}
