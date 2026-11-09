import {
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc, and, gte, lt, sql } from 'drizzle-orm';
import { financeExpense } from '@server/database/schema';
import type { FinanceExpense, PageResult } from '@shared/api.interface';
import { getOrderNoSettings } from '@server/modules/system/order-no-config';

interface FinanceExpenseCreateInput {
  expenseDate?: string;
  itemId?: string;
  itemName?: string;
  amount?: number;
  payee?: string;
  auditStatus?: string;
  remark?: string;
}

interface FinanceExpenseUpdateInput {
  expenseDate?: string;
  itemId?: string;
  itemName?: string;
  amount?: number;
  payee?: string;
  auditStatus?: string;
  remark?: string;
}

@Injectable()
export class FinanceExpenseService {
  private readonly logger = new Logger(FinanceExpenseService.name);

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
  ): Promise<PageResult<FinanceExpense>> {
    const conditions = [];
    if (keyword) {
      conditions.push(ilike(financeExpense.expenseNo, `%${keyword}%`));
    }
    if (status) {
      conditions.push(eq(financeExpense.auditStatus, status));
    }
    if (startDate) {
      conditions.push(gte(financeExpense.expenseDate, startDate));
    }
    if (endDate) {
      conditions.push(lt(financeExpense.expenseDate, endDate));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(financeExpense)
        .where(where)
        .orderBy(desc(financeExpense.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(financeExpense)
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

  async get(id: string): Promise<FinanceExpense> {
    const rows = await this.db
      .select()
      .from(financeExpense)
      .where(eq(financeExpense.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('财务支出单不存在');
    }

    return this.toDto(rows[0]);
  }

  async create(data: FinanceExpenseCreateInput): Promise<FinanceExpense> {
    const expenseNo = await this.generateNo();

    const inserted = await this.db
      .insert(financeExpense)
      .values({
        expenseNo,
        expenseDate: data.expenseDate,
        itemId: data.itemId,
        itemName: data.itemName,
        amount: data.amount !== undefined ? String(data.amount) : '0',
        payee: data.payee,
        auditStatus: data.auditStatus ?? 'draft',
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建财务支出单: ${expenseNo}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: FinanceExpenseUpdateInput): Promise<FinanceExpense> {
    const existing = await this.db
      .select()
      .from(financeExpense)
      .where(eq(financeExpense.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('财务支出单不存在');
    }

    const patch: Record<string, unknown> = {};
    if (data.expenseDate !== undefined) patch.expenseDate = data.expenseDate;
    if (data.itemId !== undefined) patch.itemId = data.itemId;
    if (data.itemName !== undefined) patch.itemName = data.itemName;
    if (data.amount !== undefined) patch.amount = String(data.amount);
    if (data.payee !== undefined) patch.payee = data.payee;
    if (data.auditStatus !== undefined) patch.auditStatus = data.auditStatus;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      return this.toDto(existing[0]);
    }

    const updated = await this.db
      .update(financeExpense)
      .set(patch)
      .where(eq(financeExpense.id, id))
      .returning();

    this.logger.log(`更新财务支出单: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(financeExpense)
      .where(eq(financeExpense.id, id))
      .returning({ id: financeExpense.id });

    if (deleted.length === 0) {
      throw new NotFoundException('财务支出单不存在');
    }

    this.logger.log(`删除财务支出单: ${id}`);
  }

  private async generateNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const prefix = `ZC${datePart}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const rows = await this.db
      .select({ expenseNo: financeExpense.expenseNo })
      .from(financeExpense)
      .where(ilike(financeExpense.expenseNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${financeExpense.expenseNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (rows.length > 0) {
      const lastNo = rows[0].expenseNo;
      const lastSeq = parseInt(lastNo.slice(10), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(cfg.digits, '0')}`;
  }

  private toDto(row: typeof financeExpense.$inferSelect): FinanceExpense {
    return {
      id: row.id,
      expenseNo: row.expenseNo,
      expenseDate: row.expenseDate,
      itemId: row.itemId ?? undefined,
      itemName: row.itemName ?? undefined,
      amount: Number(row.amount),
      payee: row.payee ?? undefined,
      auditStatus: row.auditStatus ?? 'draft',
      remark: row.remark ?? undefined,
    };
  }
}
