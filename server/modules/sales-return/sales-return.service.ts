import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, like, gte, lte, desc, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/local';
import {
  salesReturn,
  salesReturnItem,
  customer,
  product,
  salesDelivery,
} from '@server/database/schema';
import type { SalesReturn, DeliveryItem, PageResult } from '@shared/api.interface';
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

const mapReturn = (row: Record<string, unknown>): SalesReturn => ({
  id: row.id as string,
  returnNo: row.returnNo as string,
  returnDate: row.returnDate as string,
  customerId: row.customerId as string,
  customerName: (row.customerName as string) ?? undefined,
  deliveryId: (row.deliveryId as string) ?? undefined,
  deliveryNo: (row.deliveryNo as string) ?? undefined,
  totalAmount: toNum(row.totalAmount as string | number | null | undefined),
  auditStatus: row.auditStatus as 'draft' | 'audited',
  remark: (row.remark as string) ?? undefined,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt as string) || undefined,
});

const mapItem = (row: Record<string, unknown>): DeliveryItem => ({
  id: row.id as string,
  productId: (row.productId as string) ?? undefined,
  productName: row.productName as string,
  spec: (row.spec as string) ?? undefined,
  unit: (row.unit as string) ?? undefined,
  quantity: toNum(row.quantity as string | number | null | undefined),
  price: toNum(row.price as string | number | null | undefined),
  amount: toNum(row.amount as string | number | null | undefined),
  sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : Number(row.sortOrder ?? 0),
});

@Injectable()
export class SalesReturnService {
  private readonly logger = new Logger(SalesReturnService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private async generateReturnNo(): Promise<string> {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const prefix = `XT${dateStr}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const result = await this.db
      .select({ returnNo: salesReturn.returnNo })
      .from(salesReturn)
      .where(like(salesReturn.returnNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${salesReturn.returnNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (result.length > 0 && result[0].returnNo) {
      const n = Number.parseInt(result[0].returnNo.slice(10), 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    return formatOrderNo(prefix, seq, cfg.digits);
  }

  async list(query: ListQuery): Promise<PageResult<SalesReturn>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.keyword) conditions.push(like(salesReturn.returnNo, `%${query.keyword}%`));
    if (query.customerId) conditions.push(eq(salesReturn.customerId, query.customerId));
    if (query.auditStatus) conditions.push(eq(salesReturn.auditStatus, query.auditStatus));
    if (query.startDate) conditions.push(gte(salesReturn.returnDate, query.startDate));
    if (query.endDate) conditions.push(lte(salesReturn.returnDate, query.endDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          id: salesReturn.id,
          returnNo: salesReturn.returnNo,
          returnDate: salesReturn.returnDate,
          customerId: salesReturn.customerId,
          deliveryId: salesReturn.deliveryId,
          totalAmount: salesReturn.totalAmount,
          auditStatus: salesReturn.auditStatus,
          remark: salesReturn.remark,
          createdAt: salesReturn.createdAt,
          customerName: customer.name,
          deliveryNo: salesDelivery.orderNo,
        })
        .from(salesReturn)
        .leftJoin(customer, eq(salesReturn.customerId, customer.id))
        .leftJoin(salesDelivery, eq(salesReturn.deliveryId, salesDelivery.id))
        .where(where)
        .orderBy(desc(salesReturn.returnDate), desc(salesReturn.returnNo))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(salesReturn)
        .where(where),
    ]);

    const total = Number(totalRow[0]?.count ?? 0);
    const items: SalesReturn[] = rows.map((row: Record<string, unknown>) => mapReturn(row));
    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<SalesReturn> {
    const rows = await this.db
      .select({
        id: salesReturn.id,
        returnNo: salesReturn.returnNo,
        returnDate: salesReturn.returnDate,
        customerId: salesReturn.customerId,
        deliveryId: salesReturn.deliveryId,
        totalAmount: salesReturn.totalAmount,
        auditStatus: salesReturn.auditStatus,
        remark: salesReturn.remark,
        customerName: customer.name,
        deliveryNo: salesDelivery.orderNo,
      })
      .from(salesReturn)
      .leftJoin(customer, eq(salesReturn.customerId, customer.id))
      .leftJoin(salesDelivery, eq(salesReturn.deliveryId, salesDelivery.id))
      .where(eq(salesReturn.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('销售退货单不存在');

    const itemRows = await this.db
      .select()
      .from(salesReturnItem)
      .where(eq(salesReturnItem.returnId, id))
      .orderBy(salesReturnItem.sortOrder);

    const result = mapReturn(rows[0] as unknown as Record<string, unknown>);
    result.items = (itemRows as unknown as Record<string, unknown>[]).map(r => mapItem(r));
    return result;
  }

  async create(data: Partial<SalesReturn> & { items?: DeliveryItem[] }): Promise<SalesReturn> {
    const items = data.items ?? [];
    if (items.length === 0) throw new BadRequestException('明细不能为空');

    const returnNo = data.returnNo || (await this.generateReturnNo());
    const totalAmount = items.reduce((sum: number, it: DeliveryItem) => sum + (it.amount || 0), 0);

    const result = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(salesReturn)
        .values({
          returnNo,
          returnDate: data.returnDate || todayDateStr(),
          customerId: data.customerId!,
          deliveryId: data.deliveryId || null,
          totalAmount: String(totalAmount),
          auditStatus: 'draft',
          remark: data.remark || null,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(salesReturnItem).values(
          items.map((it: DeliveryItem, idx: number) => ({
            returnId: inserted.id,
            productId: it.productId || null,
            productName: it.productName,
            spec: it.spec || null,
            unit: it.unit || null,
            quantity: String(it.quantity),
            price: String(it.price),
            amount: String(it.amount),
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }
      return inserted;
    });

    this.logger.log(`创建销售退货单: ${returnNo}`);
    return this.get(result.id);
  }

  async update(id: string, data: Partial<SalesReturn> & { items?: DeliveryItem[] }): Promise<SalesReturn> {
    const existing = await this.db
      .select()
      .from(salesReturn)
      .where(eq(salesReturn.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售退货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items ?? [];
    const totalAmount = items.reduce((sum: number, it: DeliveryItem) => sum + (it.amount || 0), 0);

    await this.db.transaction(async (tx) => {
      await tx
        .update(salesReturn)
        .set({
          returnDate: data.returnDate || existing[0].returnDate,
          customerId: data.customerId || existing[0].customerId,
          deliveryId: data.deliveryId !== undefined ? (data.deliveryId || null) : existing[0].deliveryId,
          totalAmount: String(totalAmount),
          remark: data.remark !== undefined ? data.remark : existing[0].remark,
        })
        .where(eq(salesReturn.id, id));

      await tx.delete(salesReturnItem).where(eq(salesReturnItem.returnId, id));

      if (items.length > 0) {
        await tx.insert(salesReturnItem).values(
          items.map((it: DeliveryItem, idx: number) => ({
            returnId: id,
            productId: it.productId || null,
            productName: it.productName,
            spec: it.spec || null,
            unit: it.unit || null,
            quantity: String(it.quantity),
            price: String(it.price),
            amount: String(it.amount),
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }
    });

    this.logger.log(`更新销售退货单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(salesReturn)
      .where(eq(salesReturn.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售退货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(salesReturn).where(eq(salesReturn.id, id));
    this.logger.log(`删除销售退货单: ${id}`);
  }

  async audit(id: string): Promise<SalesReturn> {
    const existing = await this.db
      .select()
      .from(salesReturn)
      .where(eq(salesReturn.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售退货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const itemRows = await this.db
      .select()
      .from(salesReturnItem)
      .where(eq(salesReturnItem.returnId, id));

    const totalAmount = toNum(existing[0].totalAmount);

    await this.db.transaction(async (tx) => {
      // 库存加回
      for (const item of itemRows) {
        if (!item.productId) continue;
        const qty = toNum(item.quantity);
        await tx
          .update(product)
          .set({ stockQty: sql<string>`${product.stockQty} + ${qty}` })
          .where(eq(product.id, item.productId));
      }

      // 客户欠款减少
      await tx
        .update(customer)
        .set({
          totalAmount: sql<string>`${customer.totalAmount} - ${totalAmount}`,
          debtAmount: sql<string>`${customer.debtAmount} - ${totalAmount}`,
        })
        .where(eq(customer.id, existing[0].customerId));

      // 更新状态
      await tx
        .update(salesReturn)
        .set({ auditStatus: 'audited' })
        .where(eq(salesReturn.id, id));
    });

    this.logger.log(`审核销售退货单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<SalesReturn> {
    const existing = await this.db
      .select()
      .from(salesReturn)
      .where(eq(salesReturn.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售退货单不存在');
    if (existing[0].auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const itemRows = await this.db
      .select()
      .from(salesReturnItem)
      .where(eq(salesReturnItem.returnId, id));

    const totalAmount = toNum(existing[0].totalAmount);

    await this.db.transaction(async (tx) => {
      // 库存扣回
      for (const item of itemRows) {
        if (!item.productId) continue;
        const qty = toNum(item.quantity);
        const updated = await tx
          .update(product)
          .set({ stockQty: sql<string>`${product.stockQty} - ${qty}` })
          .where(
            and(
              eq(product.id, item.productId),
              sql`${product.stockQty} >= ${qty}`,
            ),
          )
          .returning({ id: product.id });
        if (updated.length === 0) {
          throw new BadRequestException(`库存不足，无法反审核：${item.productName}`);
        }
      }

      // 客户欠款加回
      await tx
        .update(customer)
        .set({
          totalAmount: sql<string>`${customer.totalAmount} + ${totalAmount}`,
          debtAmount: sql<string>`${customer.debtAmount} + ${totalAmount}`,
        })
        .where(eq(customer.id, existing[0].customerId));

      // 状态回退
      await tx
        .update(salesReturn)
        .set({ auditStatus: 'draft' })
        .where(eq(salesReturn.id, id));
    });

    this.logger.log(`反审核销售退货单: ${id}`);
    return this.get(id);
  }
}
