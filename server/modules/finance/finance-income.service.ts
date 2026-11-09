import {
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc, and, gte, lt } from 'drizzle-orm';
import { financeIncome } from '@server/database/schema';
import type { FinanceIncome, PageResult } from '@shared/api.interface';

interface FinanceIncomeCreateInput {
  incomeDate?: string;
  itemId?: string;
  itemName?: string;
  amount?: number;
  payer?: string;
  auditStatus?: string;
  remark?: string;
}

interface FinanceIncomeUpdateInput {
  incomeDate?: string;
  itemId?: string;
  itemName?: string;
  amount?: number;
  payer?: string;
  auditStatus?: string;
  remark?: string;
}

@Injectable()
export class FinanceIncomeService {
  private readonly logger = new Logger(FinanceIncomeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(
    page: number,
    pageSize: number,
    keyword?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<PageResult<FinanceIncome>> {
    const conditions = [];
    if (keyword) {
      conditions.push(ilike(financeIncome.incomeNo, `%${keyword}%`));
    }
    if (status) {
      conditions.push(eq(financeIncome.auditStatus, status));
    }
    if (startDate) {
      conditions.push(gte(financeIncome.incomeDate, startDate));
    }
    if (endDate) {
      conditions.push(lt(financeIncome.incomeDate, endDate));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(financeIncome)
        .where(where)
        .orderBy(desc(financeIncome.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(financeIncome)
        .where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<FinanceIncome> {
    const rows = await this.db
      .select()
      .from(financeIncome)
      .where(eq(financeIncome.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('财务收入单不存在');
    }

    return this.toDto(rows[0]);
  }

  async create(data: FinanceIncomeCreateInput): Promise<FinanceIncome> {
    const incomeNo = await this.generateNo();

    const inserted = await this.db
      .insert(financeIncome)
      .values({
        incomeNo,
        incomeDate: data.incomeDate,
        itemId: data.itemId,
        itemName: data.itemName,
        amount: data.amount !== undefined ? String(data.amount) : '0',
        payer: data.payer,
        auditStatus: data.auditStatus ?? 'draft',
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建财务收入单: ${incomeNo}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: FinanceIncomeUpdateInput): Promise<FinanceIncome> {
    const existing = await this.db
      .select()
      .from(financeIncome)
      .where(eq(financeIncome.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('财务收入单不存在');
    }

    const patch: Record<string, unknown> = {};
    if (data.incomeDate !== undefined) patch.incomeDate = data.incomeDate;
    if (data.itemId !== undefined) patch.itemId = data.itemId;
    if (data.itemName !== undefined) patch.itemName = data.itemName;
    if (data.amount !== undefined) patch.amount = String(data.amount);
    if (data.payer !== undefined) patch.payer = data.payer;
    if (data.auditStatus !== undefined) patch.auditStatus = data.auditStatus;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      return this.toDto(existing[0]);
    }

    const updated = await this.db
      .update(financeIncome)
      .set(patch)
      .where(eq(financeIncome.id, id))
      .returning();

    this.logger.log(`更新财务收入单: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(financeIncome)
      .where(eq(financeIncome.id, id))
      .returning({ id: financeIncome.id });

    if (deleted.length === 0) {
      throw new NotFoundException('财务收入单不存在');
    }

    this.logger.log(`删除财务收入单: ${id}`);
  }

  private async generateNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const prefix = `SR${datePart}`;

    const rows = await this.db
      .select({ incomeNo: financeIncome.incomeNo })
      .from(financeIncome)
      .where(ilike(financeIncome.incomeNo, `${prefix}%`))
      .orderBy(desc(financeIncome.incomeNo))
      .limit(1);

    let seq = 1;
    if (rows.length > 0) {
      const lastNo = rows[0].incomeNo;
      const lastSeq = parseInt(lastNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private toDto(row: typeof financeIncome.$inferSelect): FinanceIncome {
    return {
      id: row.id,
      incomeNo: row.incomeNo,
      incomeDate: row.incomeDate,
      itemId: row.itemId ?? undefined,
      itemName: row.itemName ?? undefined,
      amount: Number(row.amount),
      payer: row.payer ?? undefined,
      auditStatus: row.auditStatus ?? 'draft',
      remark: row.remark ?? undefined,
    };
  }
}
