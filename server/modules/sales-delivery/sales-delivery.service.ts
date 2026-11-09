import { Inject, Injectable, Logger, NotFoundException, BadRequestException, type OnModuleInit } from '@nestjs/common';
import { eq, and, like, gte, lte, desc, sql, inArray, or, isNull } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  salesDelivery,
  salesDeliveryItem,
  customer,
  product,
} from '@server/database/schema';
import type { SalesDelivery, DeliveryItem, PageResult } from '@shared/api.interface';
import {
  formatOrderNo,
  getOrderNoSettings,
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

/** drizzle 事务对象的类型，bindItems 与主流程共用 */
type TxDb = Parameters<Parameters<PostgresJsDatabase['transaction']>[0]>[0];

const mapDelivery = (row: Record<string, unknown>): SalesDelivery => ({
  id: row.id as string,
  orderNo: row.orderNo as string,
  orderDate: row.orderDate as string,
  customerId: row.customerId as string,
  customerName: (row.customerName as string) ?? undefined,
  totalAmount: toNum(row.totalAmount as string | number | null | undefined),
  paidAmount: toNum(row.paidAmount as string | number | null | undefined),
  debtAmount: toNum(row.debtAmount as string | number | null | undefined),
  receiptStatus: row.receiptStatus as string,
  returnStatus: row.returnStatus as string,
  auditStatus: row.auditStatus as 'draft' | 'audited',
  printStatus: (row.printStatus as 'unprinted' | 'printed') ?? 'unprinted',
  printCount:
    typeof row.printCount === 'number' ? row.printCount : Number(row.printCount ?? 0),
  printedAt:
    row.printedAt instanceof Date
      ? row.printedAt.toISOString()
      : ((row.printedAt as string) ?? undefined),
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
  remark: (row.remark as string) ?? undefined,
  sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : Number(row.sortOrder ?? 0),
});

@Injectable()
export class SalesDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(SalesDeliveryService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * 打印状态字段的幂等补齐：老库升级后不需要手工跑 SQL，重启即生效。
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.db.execute(
        sql`ALTER TABLE sales_delivery ADD COLUMN IF NOT EXISTS print_status varchar(20) DEFAULT 'unprinted'`,
      );
      await this.db.execute(
        sql`ALTER TABLE sales_delivery ADD COLUMN IF NOT EXISTS print_count integer DEFAULT 0`,
      );
      await this.db.execute(
        sql`ALTER TABLE sales_delivery ADD COLUMN IF NOT EXISTS printed_at timestamptz`,
      );
      this.logger.log('打印状态字段已就绪');
    } catch (err) {
      this.logger.warn(`打印状态字段初始化失败（不影响启动）: ${(err as Error).message}`);
    }
  }

  private async generateOrderNo(): Promise<string> {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const prefix = `XS${dateStr}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const result = await this.db
      .select({ orderNo: salesDelivery.orderNo })
      .from(salesDelivery)
      .where(like(salesDelivery.orderNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${salesDelivery.orderNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (result.length > 0 && result[0].orderNo) {
      const n = Number.parseInt(result[0].orderNo.slice(10), 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    return formatOrderNo(prefix, seq, cfg.digits);
  }

  async list(query: ListQuery): Promise<PageResult<SalesDelivery>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.keyword) conditions.push(like(salesDelivery.orderNo, `%${query.keyword}%`));
    if (query.customerId) conditions.push(eq(salesDelivery.customerId, query.customerId));
    if (query.auditStatus) conditions.push(eq(salesDelivery.auditStatus, query.auditStatus));
    if (query.startDate) conditions.push(gte(salesDelivery.orderDate, query.startDate));
    if (query.endDate) conditions.push(lte(salesDelivery.orderDate, query.endDate));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          id: salesDelivery.id,
          orderNo: salesDelivery.orderNo,
          orderDate: salesDelivery.orderDate,
          customerId: salesDelivery.customerId,
          totalAmount: salesDelivery.totalAmount,
          paidAmount: salesDelivery.paidAmount,
          debtAmount: salesDelivery.debtAmount,
          receiptStatus: salesDelivery.receiptStatus,
          returnStatus: salesDelivery.returnStatus,
          auditStatus: salesDelivery.auditStatus,
          printStatus: salesDelivery.printStatus,
          printCount: salesDelivery.printCount,
          printedAt: salesDelivery.printedAt,
          remark: salesDelivery.remark,
          createdAt: salesDelivery.createdAt,
          customerName: customer.name,
        })
        .from(salesDelivery)
        .leftJoin(customer, eq(salesDelivery.customerId, customer.id))
        .where(where)
        .orderBy(desc(salesDelivery.orderDate), desc(salesDelivery.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(salesDelivery)
        .where(where),
    ]);

    const total = Number(totalRow[0]?.count ?? 0);
    const items: SalesDelivery[] = rows.map((row: Record<string, unknown>) => mapDelivery(row));

    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<SalesDelivery> {
    const rows = await this.db
      .select({
        id: salesDelivery.id,
        orderNo: salesDelivery.orderNo,
        orderDate: salesDelivery.orderDate,
        customerId: salesDelivery.customerId,
        totalAmount: salesDelivery.totalAmount,
        paidAmount: salesDelivery.paidAmount,
        debtAmount: salesDelivery.debtAmount,
        receiptStatus: salesDelivery.receiptStatus,
        returnStatus: salesDelivery.returnStatus,
        auditStatus: salesDelivery.auditStatus,
        printStatus: salesDelivery.printStatus,
        printCount: salesDelivery.printCount,
        printedAt: salesDelivery.printedAt,
        remark: salesDelivery.remark,
        createdAt: salesDelivery.createdAt,
        customerName: customer.name,
      })
      .from(salesDelivery)
      .leftJoin(customer, eq(salesDelivery.customerId, customer.id))
      .where(eq(salesDelivery.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('销售送货单不存在');

    const itemRows = await this.db
      .select()
      .from(salesDeliveryItem)
      .where(eq(salesDeliveryItem.deliveryId, id))
      .orderBy(salesDeliveryItem.sortOrder);

    const result = mapDelivery(rows[0] as unknown as Record<string, unknown>);
    result.items = (itemRows as unknown as Record<string, unknown>[]).map(r => mapItem(r));
    return result;
  }

  /**
   * 明细行绑定商品档案：没绑定的按「名称+规格」找，找不到就建档。
   * 手打商品名或手填规格的行，保存后同样会进商品资料。
   */
  private async bindItems(tx: TxDb, items: DeliveryItem[]): Promise<DeliveryItem[]> {
    const out: DeliveryItem[] = [];
    for (const it of items) {
      const name = (it.productName || '').trim();
      const spec = (it.spec || '').trim();
      let productId: string | undefined = it.productId || undefined;
      if (!productId && name) {
        const specCond = spec
          ? eq(product.spec, spec)
          : or(isNull(product.spec), eq(product.spec, ''));
        const found = await tx
          .select({ id: product.id })
          .from(product)
          .where(and(eq(product.name, name), specCond))
          .limit(1);
        if (found.length > 0) {
          productId = found[0].id;
        } else {
          const created = await tx
            .insert(product)
            .values({
              name,
              spec,
              unit: it.unit || null,
              price: String(it.price ?? 0),
              stockQty: '0',
            })
            .returning({ id: product.id });
          productId = created[0].id;
          this.logger.log(`送货单自动建档商品: ${name}/${spec || '(无规格)'}`);
        }
      }
      out.push({ ...it, productId });
    }
    return out;
  }

  async create(data: Partial<SalesDelivery> & { items?: DeliveryItem[] }): Promise<SalesDelivery> {
    const items = data.items ?? [];
    if (items.length === 0) throw new BadRequestException('明细不能为空');

    const orderNo = data.orderNo || (await this.generateOrderNo());
    const totalAmount = items.reduce((sum: number, it: DeliveryItem) => sum + (it.amount || 0), 0);

    const result = await this.db.transaction(async (tx) => {
      const boundItems = await this.bindItems(tx, items);

      const [inserted] = await tx
        .insert(salesDelivery)
        .values({
          orderNo,
          orderDate: data.orderDate || new Date().toISOString().slice(0, 10),
          customerId: data.customerId!,
          totalAmount: String(totalAmount),
          paidAmount: '0',
          debtAmount: String(totalAmount),
          receiptStatus: 'unreceived',
          returnStatus: 'pending',
          auditStatus: 'draft',
          remark: data.remark || null,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(salesDeliveryItem).values(
          boundItems.map((it: DeliveryItem, idx: number) => ({
            deliveryId: inserted.id,
            productId: it.productId || null,
            productName: it.productName,
            spec: it.spec || null,
            unit: it.unit || null,
            quantity: String(it.quantity),
            price: String(it.price),
            amount: String(it.amount),
            remark: it.remark || null,
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }

      return inserted;
    });

    this.logger.log(`创建销售送货单: ${orderNo}`);
    return this.get(result.id);
  }

  async update(id: string, data: Partial<SalesDelivery> & { items?: DeliveryItem[] }): Promise<SalesDelivery> {
    const existing = await this.db
      .select()
      .from(salesDelivery)
      .where(eq(salesDelivery.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售送货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items ?? [];
    const totalAmount = items.reduce((sum: number, it: DeliveryItem) => sum + (it.amount || 0), 0);

    await this.db.transaction(async (tx) => {
      const boundItems = await this.bindItems(tx, items);

      await tx
        .update(salesDelivery)
        .set({
          orderDate: data.orderDate || existing[0].orderDate,
          customerId: data.customerId || existing[0].customerId,
          totalAmount: String(totalAmount),
          debtAmount: String(totalAmount - toNum(existing[0].paidAmount)),
          remark: data.remark !== undefined ? data.remark : existing[0].remark,
        })
        .where(eq(salesDelivery.id, id));

      await tx.delete(salesDeliveryItem).where(eq(salesDeliveryItem.deliveryId, id));

      if (items.length > 0) {
        await tx.insert(salesDeliveryItem).values(
          boundItems.map((it: DeliveryItem, idx: number) => ({
            deliveryId: id,
            productId: it.productId || null,
            productName: it.productName,
            spec: it.spec || null,
            unit: it.unit || null,
            quantity: String(it.quantity),
            price: String(it.price),
            amount: String(it.amount),
            remark: it.remark || null,
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }
    });

    this.logger.log(`更新销售送货单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(salesDelivery)
      .where(eq(salesDelivery.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售送货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(salesDelivery).where(eq(salesDelivery.id, id));
    this.logger.log(`删除销售送货单: ${id}`);
  }

  async audit(id: string): Promise<SalesDelivery> {
    const existing = await this.db
      .select()
      .from(salesDelivery)
      .where(eq(salesDelivery.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售送货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const itemRows = await this.db
      .select()
      .from(salesDeliveryItem)
      .where(eq(salesDeliveryItem.deliveryId, id));

    const totalAmount = toNum(existing[0].totalAmount);

    await this.db.transaction(async (tx) => {
      // 扣减库存：不拦截负库存，扣成负数时记一条警告（库存以入库/盘点为准）
      for (const item of itemRows) {
        if (!item.productId) continue;
        const qty = toNum(item.quantity);
        const updated = await tx
          .update(product)
          .set({ stockQty: sql<string>`${product.stockQty} - ${qty}` })
          .where(eq(product.id, item.productId))
          .returning({ id: product.id, stockQty: product.stockQty });
        if (updated.length === 0) {
          this.logger.warn(`商品档案不存在，跳过库存扣减: ${item.productName}`);
          continue;
        }
        if (toNum(updated[0].stockQty) < 0) {
          this.logger.warn(
            `库存扣成负数: ${item.productName} → ${updated[0].stockQty}（未做入库）`,
          );
        }
      }

      // 更新客户金额
      await tx
        .update(customer)
        .set({
          totalAmount: sql<string>`${customer.totalAmount} + ${totalAmount}`,
          debtAmount: sql<string>`${customer.debtAmount} + ${totalAmount}`,
        })
        .where(eq(customer.id, existing[0].customerId));

      // 更新单据状态
      await tx
        .update(salesDelivery)
        .set({ auditStatus: 'audited' })
        .where(eq(salesDelivery.id, id));
    });

    this.logger.log(`审核销售送货单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<SalesDelivery> {
    const existing = await this.db
      .select()
      .from(salesDelivery)
      .where(eq(salesDelivery.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售送货单不存在');
    if (existing[0].auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const itemRows = await this.db
      .select()
      .from(salesDeliveryItem)
      .where(eq(salesDeliveryItem.deliveryId, id));

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

      // 客户金额回退
      await tx
        .update(customer)
        .set({
          totalAmount: sql<string>`${customer.totalAmount} - ${totalAmount}`,
          debtAmount: sql<string>`${customer.debtAmount} - ${totalAmount}`,
        })
        .where(eq(customer.id, existing[0].customerId));

      // 状态回退
      await tx
        .update(salesDelivery)
        .set({ auditStatus: 'draft' })
        .where(eq(salesDelivery.id, id));
    });

    this.logger.log(`反审核销售送货单: ${id}`);
    return this.get(id);
  }

  /**
   * 打印成功后的状态回写，对应桌面版 jxc.py 的 _mark_bill_printed。
   */
  async markPrinted(id: string): Promise<SalesDelivery> {
    const existing = await this.db
      .select({ id: salesDelivery.id })
      .from(salesDelivery)
      .where(eq(salesDelivery.id, id))
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('销售送货单不存在');

    await this.db
      .update(salesDelivery)
      .set({
        printStatus: 'printed',
        printCount: sql<number>`coalesce(${salesDelivery.printCount}, 0) + 1`,
        printedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(salesDelivery.id, id));

    this.logger.log(`回写打印状态: ${id}`);
    return this.get(id);
  }

  async batchMarkReturn(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(salesDelivery)
      .set({ returnStatus: 'returned' })
      .where(inArray(salesDelivery.id, ids));
    this.logger.log(`批量标记退货: ${ids.length} 条`);
  }
}
