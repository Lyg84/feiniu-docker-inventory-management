import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase as DrizzlePostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * 本地化替代 @lark-apaas/fullstack-nestjs-core 的数据库注入。
 * token 名称与平台包保持一致，业务 service 的 @Inject(DRIZZLE_DATABASE) 无需改动。
 */
export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';

/** 与平台包同名的类型出口，业务代码只需换 import 路径 */
export type PostgresJsDatabase = DrizzlePostgresJsDatabase;

@Injectable()
export class DatabaseConnection implements OnModuleDestroy {
  readonly client: ReturnType<typeof postgres>;
  readonly db: DrizzlePostgresJsDatabase;

  constructor() {
    const url = (process.env.DATABASE_URL ?? '').trim();
    if (!url) {
      throw new Error('[local] 缺少 DATABASE_URL 环境变量，例如 postgres://jxc:jxc@127.0.0.1:5432/jxc');
    }
    this.client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 30,
      connect_timeout: 15,
      onnotice: () => undefined,
    });
    this.db = drizzle(this.client);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    DatabaseConnection,
    {
      provide: DRIZZLE_DATABASE,
      useFactory: (connection: DatabaseConnection) => connection.db,
      inject: [DatabaseConnection],
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class LocalDatabaseModule {}
