import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/local';
import { eq } from 'drizzle-orm';
import { sysParam } from '@server/database/schema';
import type { SysParam } from '@shared/api.interface';

/** 系统内置参数：表里没有就在启动时补一条，避免页面空着没法编辑 */
const DEFAULT_PARAMS: Array<{ paramKey: string; paramName: string; paramValue: string; remark: string }> = [
  {
    paramKey: 'print_paper_type',
    paramName: '打印纸型',
    paramValue: 'pin2',
    remark: '送货单打印纸张：a4 / b5 / pin1（针式一分纸）/ pin2（针式二分纸）/ pin3（针式三分纸）',
  },
  {
    paramKey: 'company_name',
    paramName: '公司名称',
    paramValue: '',
    remark: '打印在单据抬头的公司名，留空则显示「送货单」',
  },
  {
    paramKey: 'contact_person',
    paramName: '联系人',
    paramValue: '',
    remark: '打印在单据上的联系人姓名',
  },
  {
    paramKey: 'contact_phone',
    paramName: '联系方式',
    paramValue: '',
    remark: '打印在单据上的联系电话',
  },
  {
    paramKey: 'contact_address',
    paramName: '地址',
    paramValue: '',
    remark: '打印在单据上的公司地址',
  },
  {
    paramKey: 'order_no_digits',
    paramName: '单据号位数',
    paramValue: '4',
    remark: '单号流水号位数，默认 4（XS202611090002 的 0002 就是 4 位）',
  },
  {
    paramKey: 'order_no_start',
    paramName: '起始单据号',
    paramValue: '1',
    remark: '每月第一张单据的流水号，默认 1，之后按号连续往下排',
  },
];

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
export class SysParamService implements OnModuleInit {
  private readonly logger = new Logger(SysParamService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  /** 补齐内置参数（已存在则不覆盖用户改过的值） */
  private async ensureDefaults(): Promise<void> {
    for (const item of DEFAULT_PARAMS) {
      try {
        const existing = await this.db
          .select({ id: sysParam.id })
          .from(sysParam)
          .where(eq(sysParam.paramKey, item.paramKey))
          .limit(1);
        if (existing.length === 0) {
          await this.db.insert(sysParam).values(item);
          this.logger.log(`系统参数初始化: ${item.paramKey}=${item.paramValue}`);
        }
      } catch (err) {
        this.logger.warn(`系统参数初始化失败(${item.paramKey}): ${(err as Error).message}`);
      }
    }
  }

  /** 取某个参数的字符串值，没有则返回默认值 */
  async getValue(paramKey: string, fallback = ''): Promise<string> {
    const rows = await this.db
      .select({ paramValue: sysParam.paramValue })
      .from(sysParam)
      .where(eq(sysParam.paramKey, paramKey))
      .limit(1);
    return rows[0]?.paramValue ?? fallback;
  }

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
