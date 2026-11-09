import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql } from 'drizzle-orm';
import type { PurchaseIn } from '@shared/api.interface';
import {
  purchaseIn,
  purchaseInItem,
  product,
  supplier,
} from '@server/database/schema';

@Injectable()
export class PurchaseInService {
  private readonly logger = new Logger(PurchaseInService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    supplierId?: string;
    auditStatus?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: PurchaseIn[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, keyword, supplierId, auditStatus, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (keyword) conditions.push(ilike(purchaseIn.inNo, `%${keyword}%`));
    if (supplierId) conditions.push(eq(purchaseIn.supplierId, supplierId));
    if (auditStatus) conditions.push(eq(purchaseIn.auditStatus, auditStatus));
    if (startDate) conditions.push(gte(purchaseIn.inDate, startDate));
    if (endDate) conditions.push(lte(purchaseIn.inDate, endDate));

    const baseQuery = this.db
      .select({
        id: purchaseIn.id,
        inNo: purchaseIn.inNo,
        inDate: purchaseIn.inDate,
        supplierId: purchaseIn.supplierId,
        supplierName: supplier.name,
        totalAmount: purchaseIn.totalAmount,
        paidAmount: purchaseIn.paidAmount,
        debtAmount: purchaseIn.debtAmount,
        auditStatus: purchaseIn.auditStatus,
        remark: purchaseIn.remark,
        createdAt: purchaseIn.createdAt,
      })
      .from(purchaseIn)
      .leftJoin(supplier, eq(purchaseIn.supplierId, supplier.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [rows, countResult] = await Promise.all([
      baseQuery.limit(pageSize).offset(offset).orderBy(desc(purchaseIn.inDate), desc(purchaseIn.inNo)),
      this.db
        .select({ count: count() })
        .from(purchaseIn)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: PurchaseIn[] = rows.map((row) => ({
      id: row.id,
      inNo: row.inNo,
      inDate: String(row.inDate),
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      totalAmount: Number(row.totalAmount),
      paidAmount: Number(row.paidAmount),
      debtAmount: Number(row.debtAmount),
      auditStatus: row.auditStatus as 'draft' | 'audited',
      remark: row.remark ?? undefined,
      createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    }));

    return {
      items,
      total: Number(countResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<PurchaseIn> {
    const rows = await this.db
      .select({
        id: purchaseIn.id,
        inNo: purchaseIn.inNo,
        inDate: purchaseIn.inDate,
        supplierId: purchaseIn.supplierId,
        supplierName: supplier.name,
        totalAmount: purchaseIn.totalAmount,
        paidAmount: purchaseIn.paidAmount,
        debtAmount: purchaseIn.debtAmount,
        auditStatus: purchaseIn.auditStatus,
        remark: purchaseIn.remark,
        createdAt: purchaseIn.createdAt,
      })
      .from(purchaseIn)
      .leftJoin(supplier, eq(purchaseIn.supplierId, supplier.id))
      .where(eq(purchaseIn.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('采购入库单不存在');

    const row = rows[0];
    const itemRows = await this.db
      .select()
      .from(purchaseInItem)
      .where(eq(purchaseInItem.inId, id))
      .orderBy(asc(purchaseInItem.sortOrder));

    return {
      id: row.id,
      inNo: row.inNo,
      inDate: String(row.inDate),
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      totalAmount: Number(row.totalAmount),
      paidAmount: Number(row.paidAmount),
      debtAmount: Number(row.debtAmount),
      auditStatus: row.auditStatus as 'draft' | 'audited',
      remark: row.remark ?? undefined,
      createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
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

  async create(data: Partial<PurchaseIn>): Promise<PurchaseIn> {
    if (!data.supplierId) throw new BadRequestException('供应商不能为空');
    if (!data.items || data.items.length === 0) throw new BadRequestException('明细不能为空');

    const inNo = await this.generateNo();

    const result = await this.db.transaction(async (tx) => {
      const totalAmount = data.items!.reduce((sum: number, it) => sum + Number(it.amount || 0), 0);

      const inserted = await tx
        .insert(purchaseIn)
        .values({
          inNo,
          inDate: data.inDate,
          supplierId: data.supplierId,
          totalAmount: String(totalAmount),
          paidAmount: '0',
          debtAmount: '0',
          auditStatus: 'draft',
          remark: data.remark,
        })
        .returning({ id: purchaseIn.id });

      const inId = inserted[0].id;

      const itemValues = data.items!.map((it, idx) => ({
        inId,
        productId: it.productId,
        productName: it.productName,
        spec: it.spec,
        unit: it.unit,
        quantity: String(it.quantity || 0),
        price: String(it.price || 0),
        amount: String(it.amount || 0),
        sortOrder: it.sortOrder ?? idx,
      }));

      await tx.insert(purchaseInItem).values(itemValues);

      return inId;
    });

    this.logger.log(`创建采购入库单: ${inNo}`);
    return this.get(result);
  }

  async update(id: string, data: Partial<PurchaseIn>): Promise<PurchaseIn> {
    const existing = await this.db
      .select({ auditStatus: purchaseIn.auditStatus })
      .from(purchaseIn)
      .where(eq(purchaseIn.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('采购入库单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    if (!data.items || data.items.length === 0) throw new BadRequestException('明细不能为空');

    await this.db.transaction(async (tx) => {
      const totalAmount = data.items!.reduce((sum: number, it) => sum + Number(it.amount || 0), 0);

      const patch: Partial<typeof purchaseIn.$inferInsert> = {};
      if (data.inDate !== undefined) patch.inDate = data.inDate;
      if (data.supplierId !== undefined) patch.supplierId = data.supplierId;
      if (data.remark !== undefined) patch.remark = data.remark;
      patch.totalAmount = String(totalAmount);

      if (Object.keys(patch).length > 0) {
        await tx.update(purchaseIn).set(patch).where(eq(purchaseIn.id, id));
      }

      await tx.delete(purchaseInItem).where(eq(purchaseInItem.inId, id));

      const itemValues = data.items!.map((it, idx) => ({
        inId: id,
        productId: it.productId,
        productName: it.productName,
        spec: it.spec,
        unit: it.unit,
        quantity: String(it.quantity || 0),
        price: String(it.price || 0),
        amount: String(it.amount || 0),
        sortOrder: it.sortOrder ?? idx,
      }));

      await tx.insert(purchaseInItem).values(itemValues);
    });

    this.logger.log(`修改采购入库单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select({ auditStatus: purchaseIn.auditStatus })
      .from(purchaseIn)
      .where(eq(purchaseIn.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('采购入库单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(purchaseIn).where(eq(purchaseIn.id, id));
    this.logger.log(`删除采购入库单: ${id}`);
  }

  async audit(id: string): Promise<PurchaseIn> {
    const result = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(purchaseIn)
        .where(eq(purchaseIn.id, id))
        .limit(1);

      if (rows.length === 0) throw new NotFoundException('采购入库单不存在');
      if (rows[0].auditStatus === 'audited') {
        throw new BadRequestException('单据已审核');
      }

      const items = await tx
        .select()
        .from(purchaseInItem)
        .where(eq(purchaseInItem.inId, id));

      // 累加库存
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

      // 更新主表状态和应付款
      const total = String(rows[0].totalAmount);
      const updated = await tx
        .update(purchaseIn)
        .set({
          auditStatus: 'audited',
          debtAmount: sql`${purchaseIn.debtAmount} + ${total}::numeric`,
        })
        .where(eq(purchaseIn.id, id))
        .returning({ id: purchaseIn.id });

      if (updated.length === 0) throw new ConflictException('审核失败');
      return updated[0].id;
    });

    this.logger.log(`审核采购入库单: ${id}`);
    return this.get(result);
  }

  async unaudit(id: string): Promise<PurchaseIn> {
    const result = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(purchaseIn)
        .where(eq(purchaseIn.id, id))
        .limit(1);

      if (rows.length === 0) throw new NotFoundException('采购入库单不存在');
      if (rows[0].auditStatus !== 'audited') {
        throw new BadRequestException('仅已审核状态可反审核');
      }

      if (Number(rows[0].paidAmount) > 0) {
        throw new BadRequestException('该单据已有付款，无法反审核');
      }

      const items = await tx
        .select()
        .from(purchaseInItem)
        .where(eq(purchaseInItem.inId, id));

      // 回退库存
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

      // 回退应付款
      const total = String(rows[0].totalAmount);
      const updated = await tx
        .update(purchaseIn)
        .set({
          auditStatus: 'draft',
          debtAmount: sql`${purchaseIn.debtAmount} - ${total}::numeric`,
        })
        .where(eq(purchaseIn.id, id))
        .returning({ id: purchaseIn.id });

      if (updated.length === 0) throw new ConflictException('反审核失败');
      return updated[0].id;
    });

    this.logger.log(`反审核采购入库单: ${id}`);
    return this.get(result);
  }

  private async generateNo(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    const prefix = `CG${datePart}`;

    const rows = await this.db
      .select({ inNo: purchaseIn.inNo })
      .from(purchaseIn)
      .where(ilike(purchaseIn.inNo, `${prefix}%`))
      .orderBy(desc(purchaseIn.inNo))
      .limit(1);

    let seq = 1;
    if (rows.length > 0 && rows[0].inNo) {
      const lastSeq = parseInt(rows[0].inNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
