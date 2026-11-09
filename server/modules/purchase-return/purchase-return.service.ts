import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, asc, count, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import type { PurchaseReturn } from '@shared/api.interface';
import { getOrderNoSettings } from '@server/modules/system/order-no-config';
import {
  purchaseReturn,
  purchaseReturnItem,
  product,
  supplier,
  purchaseIn,
} from '@server/database/schema';

@Injectable()
export class PurchaseReturnService {
  private readonly logger = new Logger(PurchaseReturnService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    supplierId?: string;
    auditStatus?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: PurchaseReturn[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, keyword, supplierId, auditStatus, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (keyword) conditions.push(ilike(purchaseReturn.returnNo, `%${keyword}%`));
    if (supplierId) conditions.push(eq(purchaseReturn.supplierId, supplierId));
    if (auditStatus) conditions.push(eq(purchaseReturn.auditStatus, auditStatus));
    if (startDate) conditions.push(gte(purchaseReturn.returnDate, startDate));
    if (endDate) conditions.push(lte(purchaseReturn.returnDate, endDate));

    const baseQuery = this.db
      .select({
        id: purchaseReturn.id,
        returnNo: purchaseReturn.returnNo,
        returnDate: purchaseReturn.returnDate,
        supplierId: purchaseReturn.supplierId,
        supplierName: supplier.name,
        inId: purchaseReturn.inId,
        inNo: purchaseIn.inNo,
        totalAmount: purchaseReturn.totalAmount,
        auditStatus: purchaseReturn.auditStatus,
        remark: purchaseReturn.remark,
        createdAt: purchaseReturn.createdAt,
      })
      .from(purchaseReturn)
      .leftJoin(supplier, eq(purchaseReturn.supplierId, supplier.id))
      .leftJoin(purchaseIn, eq(purchaseReturn.inId, purchaseIn.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [rows, countResult] = await Promise.all([
      baseQuery.limit(pageSize).offset(offset).orderBy(desc(purchaseReturn.returnDate), desc(purchaseReturn.returnNo)),
      this.db
        .select({ count: count() })
        .from(purchaseReturn)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: PurchaseReturn[] = rows.map((row) => ({
      id: row.id,
      returnNo: row.returnNo,
      returnDate: String(row.returnDate),
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      inId: row.inId ?? undefined,
      inNo: row.inNo ?? undefined,
      totalAmount: Number(row.totalAmount),
      auditStatus: row.auditStatus as 'draft' | 'audited',
      remark: row.remark ?? undefined,
    }));

    return {
      items,
      total: Number(countResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<PurchaseReturn> {
    const rows = await this.db
      .select({
        id: purchaseReturn.id,
        returnNo: purchaseReturn.returnNo,
        returnDate: purchaseReturn.returnDate,
        supplierId: purchaseReturn.supplierId,
        supplierName: supplier.name,
        inId: purchaseReturn.inId,
        inNo: purchaseIn.inNo,
        totalAmount: purchaseReturn.totalAmount,
        auditStatus: purchaseReturn.auditStatus,
        remark: purchaseReturn.remark,
        createdAt: purchaseReturn.createdAt,
      })
      .from(purchaseReturn)
      .leftJoin(supplier, eq(purchaseReturn.supplierId, supplier.id))
      .leftJoin(purchaseIn, eq(purchaseReturn.inId, purchaseIn.id))
      .where(eq(purchaseReturn.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('采购退货单不存在');

    const row = rows[0];
    const itemRows = await this.db
      .select()
      .from(purchaseReturnItem)
      .where(eq(purchaseReturnItem.returnId, id))
      .orderBy(asc(purchaseReturnItem.sortOrder));

    return {
      id: row.id,
      returnNo: row.returnNo,
      returnDate: String(row.returnDate),
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      inId: row.inId ?? undefined,
      inNo: row.inNo ?? undefined,
      totalAmount: Number(row.totalAmount),
      auditStatus: row.auditStatus as 'draft' | 'audited',
      remark: row.remark ?? undefined,
      items: itemRows.map((it) => ({
        id: it.id,
        productId: it.productId ?? undefined,
        productName: it.productName,
        spec: it.spec ?? undefined,
        unit: it.unit ?? undefined,
        quantity: Number(it.quantity),
        price: Number(it.price),
        amount: Number(it.amount),
        sortOrder: it.sortOrder ?? 0,
      })),
    };
  }

  async create(data: Partial<PurchaseReturn>): Promise<PurchaseReturn> {
    if (!data.supplierId) throw new BadRequestException('供应商不能为空');
    if (!data.items || data.items.length === 0) throw new BadRequestException('明细不能为空');

    const returnNo = await this.generateNo();

    const result = await this.db.transaction(async (tx) => {
      const totalAmount = data.items!.reduce((sum: number, it) => sum + Number(it.amount || 0), 0);

      const inserted = await tx
        .insert(purchaseReturn)
        .values({
          returnNo,
          returnDate: data.returnDate,
          supplierId: data.supplierId,
          inId: data.inId,
          totalAmount: String(totalAmount),
          auditStatus: 'draft',
          remark: data.remark,
        })
        .returning({ id: purchaseReturn.id });

      const returnId = inserted[0].id;

      const itemValues = data.items!.map((it, idx) => ({
        returnId,
        productId: it.productId,
        productName: it.productName,
        spec: it.spec,
        unit: it.unit,
        quantity: String(it.quantity || 0),
        price: String(it.price || 0),
        amount: String(it.amount || 0),
        sortOrder: it.sortOrder ?? idx,
      }));

      await tx.insert(purchaseReturnItem).values(itemValues);

      return returnId;
    });

    this.logger.log(`创建采购退货单: ${returnNo}`);
    return this.get(result);
  }

  async update(id: string, data: Partial<PurchaseReturn>): Promise<PurchaseReturn> {
    const existing = await this.db
      .select({ auditStatus: purchaseReturn.auditStatus })
      .from(purchaseReturn)
      .where(eq(purchaseReturn.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('采购退货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    if (!data.items || data.items.length === 0) throw new BadRequestException('明细不能为空');

    await this.db.transaction(async (tx) => {
      const totalAmount = data.items!.reduce((sum: number, it) => sum + Number(it.amount || 0), 0);

      const patch: Partial<typeof purchaseReturn.$inferInsert> = {};
      if (data.returnDate !== undefined) patch.returnDate = data.returnDate;
      if (data.supplierId !== undefined) patch.supplierId = data.supplierId;
      if (data.inId !== undefined) patch.inId = data.inId;
      if (data.remark !== undefined) patch.remark = data.remark;
      patch.totalAmount = String(totalAmount);

      if (Object.keys(patch).length > 0) {
        await tx.update(purchaseReturn).set(patch).where(eq(purchaseReturn.id, id));
      }

      await tx.delete(purchaseReturnItem).where(eq(purchaseReturnItem.returnId, id));

      const itemValues = data.items!.map((it, idx) => ({
        returnId: id,
        productId: it.productId,
        productName: it.productName,
        spec: it.spec,
        unit: it.unit,
        quantity: String(it.quantity || 0),
        price: String(it.price || 0),
        amount: String(it.amount || 0),
        sortOrder: it.sortOrder ?? idx,
      }));

      await tx.insert(purchaseReturnItem).values(itemValues);
    });

    this.logger.log(`修改采购退货单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select({ auditStatus: purchaseReturn.auditStatus })
      .from(purchaseReturn)
      .where(eq(purchaseReturn.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('采购退货单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(purchaseReturn).where(eq(purchaseReturn.id, id));
    this.logger.log(`删除采购退货单: ${id}`);
  }

  async audit(id: string): Promise<PurchaseReturn> {
    const result = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(purchaseReturn)
        .where(eq(purchaseReturn.id, id))
        .limit(1);

      if (rows.length === 0) throw new NotFoundException('采购退货单不存在');
      if (rows[0].auditStatus === 'audited') {
        throw new BadRequestException('单据已审核');
      }

      const items = await tx
        .select()
        .from(purchaseReturnItem)
        .where(eq(purchaseReturnItem.returnId, id));

      // 扣减库存
      for (const item of items) {
        if (!item.productId) continue;
        const qty = Number(item.quantity);
        if (qty <= 0) continue;
        const qtyStr = String(qty);
        await tx
          .update(product)
          .set({ stockQty: sql`${product.stockQty} - ${qtyStr}::numeric` })
          .where(eq(product.id, item.productId));
      }

      const updated = await tx
        .update(purchaseReturn)
        .set({ auditStatus: 'audited' })
        .where(eq(purchaseReturn.id, id))
        .returning({ id: purchaseReturn.id });

      if (updated.length === 0) throw new ConflictException('审核失败');
      return updated[0].id;
    });

    this.logger.log(`审核采购退货单: ${id}`);
    return this.get(result);
  }

  async unaudit(id: string): Promise<PurchaseReturn> {
    const result = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(purchaseReturn)
        .where(eq(purchaseReturn.id, id))
        .limit(1);

      if (rows.length === 0) throw new NotFoundException('采购退货单不存在');
      if (rows[0].auditStatus !== 'audited') {
        throw new BadRequestException('仅已审核状态可反审核');
      }

      const items = await tx
        .select()
        .from(purchaseReturnItem)
        .where(eq(purchaseReturnItem.returnId, id));

      // 回退库存（加回）
      for (const item of items) {
        if (!item.productId) continue;
        const qty = Number(item.quantity);
        if (qty <= 0) continue;
        const qtyStr = String(qty);
        await tx
          .update(product)
          .set({ stockQty: sql`${product.stockQty} + ${qtyStr}::numeric` })
          .where(eq(product.id, item.productId));
      }

      const updated = await tx
        .update(purchaseReturn)
        .set({ auditStatus: 'draft' })
        .where(eq(purchaseReturn.id, id))
        .returning({ id: purchaseReturn.id });

      if (updated.length === 0) throw new ConflictException('反审核失败');
      return updated[0].id;
    });

    this.logger.log(`反审核采购退货单: ${id}`);
    return this.get(result);
  }

  private async generateNo(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    const prefix = `CT${datePart}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const rows = await this.db
      .select({ returnNo: purchaseReturn.returnNo })
      .from(purchaseReturn)
      .where(ilike(purchaseReturn.returnNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${purchaseReturn.returnNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (rows.length > 0 && rows[0].returnNo) {
      const lastSeq = parseInt(rows[0].returnNo.slice(10), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(cfg.digits, '0')}`;
  }
}
