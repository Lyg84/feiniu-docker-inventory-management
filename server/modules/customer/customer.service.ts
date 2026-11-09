import { Inject, Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc } from 'drizzle-orm';
import { customer } from '@server/database/schema';
import type { Customer, PageResult } from '@shared/api.interface';

export interface ImportRowError {
  row: number;
  name?: string;
  reason: string;
}

export interface ImportResult {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
}

function trimOrUndef(value: unknown, maxLen?: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return maxLen ? s.slice(0, maxLen) : s;
}

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<Customer>> {
    const where = keyword ? [ilike(customer.name, `%${keyword}%`)] : [];
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(customer)
        .where(where.length > 0 ? where[0] : undefined)
        .orderBy(desc(customer.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(customer)
        .where(where.length > 0 ? where[0] : undefined),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      page,
      pageSize,
    };
  }

  async all(): Promise<Customer[]> {
    const rows = await this.db
      .select()
      .from(customer)
      .orderBy(desc(customer.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<Customer> {
    const rows = await this.db.select().from(customer).where(eq(customer.id, id)).limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('客户不存在');
    }
    return this.toDto(rows[0]);
  }

  async create(data: Partial<Customer> & { name: string }): Promise<Customer> {
    const existing = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.name, data.name))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('客户名称已存在');
    }

    const inserted = await this.db
      .insert(customer)
      .values({
        name: data.name,
        contactPerson: data.contactPerson,
        phone: data.phone,
        address: data.address,
        remark: data.remark,
        totalAmount: '0',
        paidAmount: '0',
        debtAmount: '0',
      })
      .returning();

    this.logger.log(`创建客户: ${data.name}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.contactPerson !== undefined) patch.contactPerson = data.contactPerson;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.address !== undefined) patch.address = data.address;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      throw new NotFoundException('未提供可更新字段');
    }

    const updated = await this.db
      .update(customer)
      .set(patch)
      .where(eq(customer.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('客户不存在');
    }

    this.logger.log(`更新客户: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(customer)
      .where(eq(customer.id, id))
      .returning({ id: customer.id });

    if (deleted.length === 0) {
      throw new NotFoundException('客户不存在');
    }

    this.logger.log(`删除客户: ${id}`);
  }

  /**
   * 批量导入客户。按 name 去重：库里已存在或文件内重复的都跳过，不覆盖原数据。
   */
  async importMany(rows: Array<Partial<Customer> & { name?: string }>): Promise<ImportResult> {
    const errors: ImportRowError[] = [];
    const accepted: Array<{
      name: string;
      contactPerson?: string;
      phone?: string;
      address?: string;
      remark?: string;
    }> = [];
    const seen = new Set<string>();

    rows.forEach((raw, idx) => {
      const lineNo = idx + 2; // 表头占第 1 行
      const name = trimOrUndef(raw?.name, 200);
      if (!name) {
        errors.push({ row: lineNo, reason: '客户名称为空' });
        return;
      }
      if (seen.has(name)) {
        errors.push({ row: lineNo, name, reason: '文件内重复，已跳过' });
        return;
      }
      seen.add(name);
      accepted.push({
        name,
        contactPerson: trimOrUndef(raw.contactPerson, 100),
        phone: trimOrUndef(raw.phone, 50),
        address: trimOrUndef(raw.address),
        remark: trimOrUndef(raw.remark),
      });
    });

    const existing = await this.db.select({ name: customer.name }).from(customer);
    const existingNames = new Set(existing.map((r) => r.name));

    const toInsert = accepted.filter((r) => !existingNames.has(r.name));
    const skipped = accepted.length - toInsert.length;

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500).map((r) => ({
        ...r,
        totalAmount: '0',
        paidAmount: '0',
        debtAmount: '0',
      }));
      if (chunk.length === 0) continue;
      const res = await this.db.insert(customer).values(chunk).returning({ id: customer.id });
      inserted += res.length;
    }

    const result: ImportResult = {
      total: rows.length,
      inserted,
      skipped,
      failed: errors.length,
      errors,
    };
    this.logger.log(
      `导入客户: 新增 ${inserted}, 跳过 ${skipped}, 失败 ${errors.length}`,
    );
    return result;
  }

  private toDto(row: typeof customer.$inferSelect): Customer {
    return {
      id: row.id,
      name: row.name,
      contactPerson: row.contactPerson ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      remark: row.remark ?? undefined,
      totalAmount: Number(row.totalAmount),
      paidAmount: Number(row.paidAmount),
      debtAmount: Number(row.debtAmount),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
