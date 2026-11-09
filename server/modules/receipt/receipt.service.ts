import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, like, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  receipt,
  receiptItem,
  customer,
  salesDelivery,
} from '@server/database/schema';
import type { Receipt, ReceiptItem, PageResult } from '@shared/api.interface';
import {
  formatOrderNo,
  getOrderNoSettings,
  todayDateStr,
} from '@server/modules/system/order-no-config';

interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  customerId?: string;
  auditStatus?: string;
  startDate?: string;
  endDate?: string;
}

const toNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
};

const mapReceipt = (row: Record<string, unknown>): Receipt => ({
  id: row.id as string,
  receiptNo: row.receiptNo as string,
  receiptDate: row.receiptDate as string,
  customerId: row.customerId as string,
  customerName: (row.customerName as string) ?? undefined,
  totalAmount: toNum(row.totalAmount as string | number | null | undefined),
  writeOffAmount: toNum(row.writeOffAmount as string | number | null | undefined),
  paymentMethod: (row.paymentMethod as string) ?? undefined,
  auditStatus: row.auditStatus as 'draft' | 'audited',
  remark: (row.remark as string) ?? undefined,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt as string) || undefined,
});

const mapItem = (row: Record<string, unknown>): ReceiptItem => ({
  id: row.id as string,
  deliveryId: (row.deliveryId as string) ?? undefined,
  deliveryNo: (row.deliveryNo as string) ?? undefined,
  amount: toNum(row.amount as string | number | null | undefined),
  sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : Number(row.sortOrder ?? 0),
});

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private async generateReceiptNo(): Promise<string> {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const prefix = `SK${dateStr}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const result = await this.db
      .select({ receiptNo: receipt.receiptNo })
      .from(receipt)
      .where(like(receipt.receiptNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${receipt.receiptNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (result.length > 0 && result[0].receiptNo) {
      const n = Number.parseInt(result[0].receiptNo.slice(10), 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    return formatOrderNo(prefix, seq, cfg.digits);
  }

  async list(query: ListQuery): Promise<PageResult<Receipt>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.keyword) conditions.push(like(receipt.receiptNo, `%${query.keyword}%`));
    if (query.customerId) conditions.push(eq(receipt.customerId, query.customerId));
    if (query.auditStatus) conditions.push(eq(receipt.auditStatus, query.auditStatus));
    if (query.startDate) conditions.push(gte(receipt.receiptDate, query.startDate));
    if (query.endDate) conditions.push(lte(receipt.receiptDate, query.endDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          id: receipt.id,
          receiptNo: receipt.receiptNo,
          receiptDate: receipt.receiptDate,
          customerId: receipt.customerId,
          totalAmount: receipt.totalAmount,
          writeOffAmount: receipt.writeOffAmount,
          paymentMethod: receipt.paymentMethod,
          auditStatus: receipt.auditStatus,
          remark: receipt.remark,
          createdAt: receipt.createdAt,
          customerName: customer.name,
        })
        .from(receipt)
        .leftJoin(customer, eq(receipt.customerId, customer.id))
        .where(where)
        .orderBy(desc(receipt.receiptDate), desc(receipt.receiptNo))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(receipt)
        .where(where),
    ]);

    const total = Number(totalRow[0]?.count ?? 0);
    const items: Receipt[] = rows.map((row: Record<string, unknown>) => mapReceipt(row));
    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<Receipt> {
    const rows = await this.db
      .select({
        id: receipt.id,
        receiptNo: receipt.receiptNo,
        receiptDate: receipt.receiptDate,
        customerId: receipt.customerId,
        totalAmount: receipt.totalAmount,
        writeOffAmount: receipt.writeOffAmount,
        paymentMethod: receipt.paymentMethod,
        auditStatus: receipt.auditStatus,
        remark: receipt.remark,
        customerName: customer.name,
      })
      .from(receipt)
      .leftJoin(customer, eq(receipt.customerId, customer.id))
      .where(eq(receipt.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('收款单不存在');

    const itemRows = await this.db
      .select({
        id: receiptItem.id,
        receiptId: receiptItem.receiptId,
        deliveryId: receiptItem.deliveryId,
        amount: receiptItem.amount,
        sortOrder: receiptItem.sortOrder,
        deliveryNo: salesDelivery.orderNo,
      })
      .from(receiptItem)
      .leftJoin(salesDelivery, eq(receiptItem.deliveryId, salesDelivery.id))
      .where(eq(receiptItem.receiptId, id))
      .orderBy(receiptItem.sortOrder);

    const result = mapReceipt(rows[0] as unknown as Record<string, unknown>);
    result.items = (itemRows as unknown as Record<string, unknown>[]).map(r => mapItem(r));
    return result;
  }

  async create(data: Partial<Receipt> & { items?: ReceiptItem[] }): Promise<Receipt> {
    const items = data.items ?? [];
    const receiptNo = data.receiptNo || (await this.generateReceiptNo());
    const writeOffAmount = items.reduce((sum: number, it: ReceiptItem) => sum + (it.amount || 0), 0);
    const totalAmount = data.totalAmount ?? writeOffAmount;

    const result = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(receipt)
        .values({
          receiptNo,
          receiptDate: data.receiptDate || todayDateStr(),
          customerId: data.customerId!,
          totalAmount: String(totalAmount),
          writeOffAmount: String(writeOffAmount),
          paymentMethod: data.paymentMethod || null,
          auditStatus: 'draft',
          remark: data.remark || null,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(receiptItem).values(
          items.map((it: ReceiptItem, idx: number) => ({
            receiptId: inserted.id,
            deliveryId: it.deliveryId || null,
            amount: String(it.amount),
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }
      return inserted;
    });

    this.logger.log(`创建收款单: ${receiptNo}`);
    return this.get(result.id);
  }

  async update(id: string, data: Partial<Receipt> & { items?: ReceiptItem[] }): Promise<Receipt> {
    const existing = await this.db
      .select()
      .from(receipt)
      .where(eq(receipt.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('收款单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items ?? [];
    const writeOffAmount = items.reduce((sum: number, it: ReceiptItem) => sum + (it.amount || 0), 0);
    const totalAmount = data.totalAmount ?? toNum(existing[0].totalAmount);

    await this.db.transaction(async (tx) => {
      await tx
        .update(receipt)
        .set({
          receiptDate: data.receiptDate || existing[0].receiptDate,
          customerId: data.customerId || existing[0].customerId,
          totalAmount: String(totalAmount),
          writeOffAmount: String(writeOffAmount),
          paymentMethod: data.paymentMethod !== undefined ? (data.paymentMethod || null) : existing[0].paymentMethod,
          remark: data.remark !== undefined ? data.remark : existing[0].remark,
        })
        .where(eq(receipt.id, id));

      await tx.delete(receiptItem).where(eq(receiptItem.receiptId, id));

      if (items.length > 0) {
        await tx.insert(receiptItem).values(
          items.map((it: ReceiptItem, idx: number) => ({
            receiptId: id,
            deliveryId: it.deliveryId || null,
            amount: String(it.amount),
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }
    });

    this.logger.log(`更新收款单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(receipt)
      .where(eq(receipt.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('收款单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(receipt).where(eq(receipt.id, id));
    this.logger.log(`删除收款单: ${id}`);
  }

  async audit(id: string): Promise<Receipt> {
    const existing = await this.db
      .select()
      .from(receipt)
      .where(eq(receipt.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('收款单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const itemRows = await this.db
      .select()
      .from(receiptItem)
      .where(eq(receiptItem.receiptId, id));

    const totalAmount = toNum(existing[0].totalAmount);

    await this.db.transaction(async (tx) => {
      // 更新客户金额
      await tx
        .update(customer)
        .set({
          paidAmount: sql<string>`${customer.paidAmount} + ${totalAmount}`,
          debtAmount: sql<string>`${customer.debtAmount} - ${totalAmount}`,
        })
        .where(eq(customer.id, existing[0].customerId));

      // 更新关联送货单
      const deliveryIds = itemRows.filter(it => it.deliveryId).map(it => it.deliveryId as string);
      if (deliveryIds.length > 0) {
        const deliveryRows = await tx
          .select()
          .from(salesDelivery)
          .where(inArray(salesDelivery.id, deliveryIds));

        for (const item of itemRows) {
          if (!item.deliveryId) continue;
          const amt = toNum(item.amount);
          const delivery = deliveryRows.find(d => d.id === item.deliveryId);
          if (!delivery) continue;

          const newPaid = toNum(delivery.paidAmount) + amt;
          const newDebt = Math.max(0, toNum(delivery.totalAmount) - newPaid);
          const newReceiptStatus = newDebt <= 0.001 ? 'received' : 'partial';

          await tx
            .update(salesDelivery)
            .set({
              paidAmount: String(newPaid),
              debtAmount: String(newDebt),
              receiptStatus: newReceiptStatus,
            })
            .where(eq(salesDelivery.id, item.deliveryId));
        }
      }

      // 更新状态
      await tx
        .update(receipt)
        .set({ auditStatus: 'audited' })
        .where(eq(receipt.id, id));
    });

    this.logger.log(`审核收款单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<Receipt> {
    const existing = await this.db
      .select()
      .from(receipt)
      .where(eq(receipt.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('收款单不存在');
    if (existing[0].auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const itemRows = await this.db
      .select()
      .from(receiptItem)
      .where(eq(receiptItem.receiptId, id));

    const totalAmount = toNum(existing[0].totalAmount);

    await this.db.transaction(async (tx) => {
      // 客户金额回退
      await tx
        .update(customer)
        .set({
          paidAmount: sql<string>`${customer.paidAmount} - ${totalAmount}`,
          debtAmount: sql<string>`${customer.debtAmount} + ${totalAmount}`,
        })
        .where(eq(customer.id, existing[0].customerId));

      // 回退关联送货单
      const deliveryIds = itemRows.filter(it => it.deliveryId).map(it => it.deliveryId as string);
      if (deliveryIds.length > 0) {
        const deliveryRows = await tx
          .select()
          .from(salesDelivery)
          .where(inArray(salesDelivery.id, deliveryIds));

        for (const item of itemRows) {
          if (!item.deliveryId) continue;
          const amt = toNum(item.amount);
          const delivery = deliveryRows.find(d => d.id === item.deliveryId);
          if (!delivery) continue;

          const newPaid = Math.max(0, toNum(delivery.paidAmount) - amt);
          const newDebt = Math.max(0, toNum(delivery.totalAmount) - newPaid);
          const newReceiptStatus = newPaid <= 0.001 ? 'unreceived' : 'partial';

          await tx
            .update(salesDelivery)
            .set({
              paidAmount: String(newPaid),
              debtAmount: String(newDebt),
              receiptStatus: newReceiptStatus,
            })
            .where(eq(salesDelivery.id, item.deliveryId));
        }
      }

      // 状态回退
      await tx
        .update(receipt)
        .set({ auditStatus: 'draft' })
        .where(eq(receipt.id, id));
    });

    this.logger.log(`反审核收款单: ${id}`);
    return this.get(id);
  }
}
