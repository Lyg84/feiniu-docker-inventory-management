import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import { sysParam } from '@server/database/schema';
import type { SysParam } from '@shared/api.interface';

function toDto(row: typeof sysParam.$inferSelect): SysParam {
  return {
    id: row.id,
    paramKey: row.paramKey,
    paramValue: row.paramValue ?? undefined,
    paramName: row.paramName ?? undefined,
    remark: row.remark ?? undefined,
  };
}

@Injectable()
export class SysParamService {
  private readonly logger = new Logger(SysParamService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(): Promise<SysParam[]> {
    const rows = await this.db.select().from(sysParam).orderBy(sysParam.paramKey);
    return rows.map((row: typeof sysParam.$inferSelect) => toDto(row));
  }

  async update(id: string, data: Partial<{ paramKey: string; paramValue: string; paramName: string; remark: string }>): Promise<SysParam> {
    const patch: Partial<typeof sysParam.$inferInsert> = {};
    if (data.paramKey !== undefined) patch.paramKey = data.paramKey;
    if (data.paramValue !== undefined) patch.paramValue = data.paramValue;
    if (data.paramName !== undefined) patch.paramName = data.paramName;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db.update(sysParam).set(patch).where(eq(sysParam.id, id)).returning();
    if (updated.length === 0) throw new NotFoundException('系统参数不存在');
    this.logger.log(`SysParam updated: id=${id}`);
    return toDto(updated[0]);
  }
}
