import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/local';
import { ilike, or, count, desc } from 'drizzle-orm';
import { sysLog } from '@server/database/schema';
import type { SysLog, PageResult } from '@shared/api.interface';

export interface SysLogInput {
  userId?: string | null;
  username?: string | null;
  action?: string | null;
  module?: string | null;
  detail?: string | null;
  ip?: string | null;
}

/** 去掉密码等敏感字段，避免把明文口令写进审计日志 */
const SENSITIVE_KEYS = ['password', 'oldPassword', 'newPassword', 'newPwd', 'oldPwd', 'token', 'csrfToken'];

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '…';
  if (Array.isArray(value)) {
    const head = value.slice(0, 3).map((item) => sanitize(item, depth + 1));
    if (value.length > 3) head.push(`…共${value.length}项`);
    return head;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(key)) {
        out[key] = '***';
        continue;
      }
      out[key] = sanitize(val, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 120) return `${value.slice(0, 120)}…`;
  return value;
}

function toDto(row: typeof sysLog.$inferSelect): SysLog {
  return {
    id: row.id,
    username: row.username ?? undefined,
    action: row.action ?? undefined,
    module: row.module ?? undefined,
    detail: row.detail ?? undefined,
    ip: row.ip ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class SysLogService {
  private readonly logger = new Logger(SysLogService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 写入一条操作日志。调用方不需要 await：
   * 审计日志失败绝不能影响业务请求，内部吞掉异常并只打警告。
   */
  async write(input: SysLogInput): Promise<void> {
    try {
      const detail = input.detail ? String(input.detail).slice(0, 2000) : null;
      await this.db.insert(sysLog).values({
        userId: input.userId ?? null,
        username: (input.username ?? '').slice(0, 100) || null,
        action: (input.action ?? '').slice(0, 100) || null,
        module: (input.module ?? '').slice(0, 100) || null,
        detail,
        ip: (input.ip ?? '').slice(0, 50) || null,
      });
    } catch (error) {
      this.logger.warn(`SysLog write failed: ${(error as Error)?.message ?? error}`);
    }
  }

  /** 把请求体压成一行摘要，敏感字段打码，供 detail 使用 */
  static summarize(body: unknown, extra?: string): string {
    const parts: string[] = [];
    if (extra) parts.push(extra);
    if (body !== undefined && body !== null && body !== '') {
      const safe = sanitize(body);
      if (safe && !(typeof safe === 'object' && Object.keys(safe as object).length === 0)) {
        parts.push(typeof safe === 'string' ? safe : JSON.stringify(safe));
      }
    }
    return parts.join(' ').slice(0, 2000);
  }

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<SysLog>> {
    const offset = (page - 1) * pageSize;

    const whereClause = keyword
      ? or(
          ilike(sysLog.username, `%${keyword}%`),
          ilike(sysLog.action, `%${keyword}%`),
          ilike(sysLog.module, `%${keyword}%`),
          ilike(sysLog.detail, `%${keyword}%`),
        )
      : undefined;

    const base = this.db.select().from(sysLog);
    const query = whereClause ? base.where(whereClause) : base;

    const [rows, totalRows] = await Promise.all([
      query.orderBy(desc(sysLog.createdAt)).limit(pageSize).offset(offset),
      this.db.select({ count: count() }).from(sysLog).where(whereClause ?? undefined),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    this.logger.log(`SysLog list query, page=${page}, pageSize=${pageSize}, total=${total}`);
    return {
      items: rows.map((row: typeof sysLog.$inferSelect) => toDto(row)),
      total,
      page,
      pageSize,
    };
  }
}
