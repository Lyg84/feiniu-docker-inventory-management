import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import type { Payment } from '@shared/api.interface';
import {
  payment,
  paymentItem,
  supplier,
  purchaseIn,
} from '@server/database/schema';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    supplierId?: string;
    auditStatus?: string;
  }): Promise<{ items: Payment[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, keyword, supplierId, auditStatus } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (keyword) conditions.push(ilike(payment.paymentNo, `%${keyword}%`));
    if (supplierId) conditions.push(eq(payment.supplierId, supplierId));
    if (auditStatus) conditions.push(eq(payment.auditStatus, auditStatus));

    const baseQuery = this.db
      .select({
        id: payment.id,
        paymentNo: payment.paymentNo,
        paymentDate: payment.paymentDate,
        supplierId: payment.supplierId,
        supplierName: supplier.name,
        totalAmount: payment.totalAmount,
        writeOffAmount: payment.writeOffAmount,
        paymentMethod: payment.paymentMethod,
        auditStatus: payment.auditStatus,
        remark: payment.remark,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .leftJoin(supplier, eq(payment.supplierId, supplier.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [rows, countResult] = await Promise.all([
      baseQuery.limit(pageSize).offset(offset).orderBy(desc(payment.paymentDate), desc(payment.paymentNo)),
      this.db
        .select({ count: count() })
        .from(payment)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items: Payment[] = rows.map((row) => ({
      id: row.id,
      paymentNo: row.paymentNo,
      paymentDate: String(row.paymentDate),
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      totalAmount: Number(row.totalAmount),
      writeOffAmount: Number(row.writeOffAmount),
      paymentMethod: row.paymentMethod ?? undefined,
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

  async get(id: string): Promise<Payment> {
    const rows = await this.db
      .select({
        id: payment.id,
        paymentNo: payment.paymentNo,
        paymentDate: payment.paymentDate,
        supplierId: payment.supplierId,
        supplierName: supplier.name,
        totalAmount: payment.totalAmount,
        writeOffAmount: payment.writeOffAmount,
        paymentMethod: payment.paymentMethod,
        auditStatus: payment.auditStatus,
        remark: payment.remark,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .leftJoin(supplier, eq(payment.supplierId, supplier.id))
      .where(eq(payment.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('付款单不存在');

    const row = rows[0];
    const itemRows = await this.db
      .select({
        id: paymentItem.id,
        inId: paymentItem.inId,
        inNo: purchaseIn.inNo,
        amount: paymentItem.amount,
        sortOrder: paymentItem.sortOrder,
      })
      .from(paymentItem)
      .leftJoin(purchaseIn, eq(paymentItem.inId, purchaseIn.id))
      .where(eq(paymentItem.paymentId, id))
      .orderBy(asc(paymentItem.sortOrder));

    return {
      id: row.id,
      paymentNo: row.paymentNo,
      paymentDate: String(row.paymentDate),
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? undefined,
      totalAmount: Number(row.totalAmount),
      writeOffAmount: Number(row.writeOffAmount),
      paymentMethod: row.paymentMethod ?? undefined,
      auditStatus: row.auditStatus as 'draft' | 'audited',
      remark: row.remark ?? undefined,
      items: itemRows.map((it) => ({
        id: it.id,
        inId: it.inId ?? undefined,
        inNo: it.inNo ?? undefined,
        amount: Number(it.amount),
        sortOrder: it.sortOrder ?? 0,
      })),
    };
  }

  async create(data: Partial<Payment>): Promise<Payment> {
    if (!data.supplierId) throw new BadRequestException('供应商不能为空');

    const paymentNo = await this.generateNo();

    const result = await this.db.transaction(async (tx) => {
      const writeOffAmount = (data.items ?? []).reduce(
        (sum: number, it) => sum + Number(it.amount || 0),
        0,
      );

      const inserted = await tx
        .insert(payment)
        .values({
          paymentNo,
          paymentDate: data.paymentDate,
          supplierId: data.supplierId,
          totalAmount: String(data.totalAmount || 0),
          writeOffAmount: String(writeOffAmount),
          paymentMethod: data.paymentMethod,
          auditStatus: 'draft',
          remark: data.remark,
        })
        .returning({ id: payment.id });

      const paymentId = inserted[0].id;

      if (data.items && data.items.length > 0) {
        const itemValues = data.items.map((it, idx) => ({
          paymentId,
          inId: it.inId,
          amount: String(it.amount || 0),
          sortOrder: it.sortOrder ?? idx,
        }));
        await tx.insert(paymentItem).values(itemValues);
      }

      return paymentId;
    });

    this.logger.log(`创建付款单: ${paymentNo}`);
    return this.get(result);
  }

  async update(id: string, data: Partial<Payment>): Promise<Payment> {
    const existing = await this.db
      .select({ auditStatus: payment.auditStatus })
      .from(payment)
      .where(eq(payment.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('付款单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    await this.db.transaction(async (tx) => {
      const writeOffAmount = (data.items ?? []).reduce(
        (sum: number, it) => sum + Number(it.amount || 0),
        0,
      );

      const patch: Partial<typeof payment.$inferInsert> = {};
      if (data.paymentDate !== undefined) patch.paymentDate = data.paymentDate;
      if (data.supplierId !== undefined) patch.supplierId = data.supplierId;
      if (data.totalAmount !== undefined) patch.totalAmount = String(data.totalAmount);
      if (data.paymentMethod !== undefined) patch.paymentMethod = data.paymentMethod;
      if (data.remark !== undefined) patch.remark = data.remark;
      patch.writeOffAmount = String(writeOffAmount);

      if (Object.keys(patch).length > 0) {
        await tx.update(payment).set(patch).where(eq(payment.id, id));
      }

      await tx.delete(paymentItem).where(eq(paymentItem.paymentId, id));

      if (data.items && data.items.length > 0) {
        const itemValues = data.items.map((it, idx) => ({
          paymentId: id,
          inId: it.inId,
          amount: String(it.amount || 0),
          sortOrder: it.sortOrder ?? idx,
        }));
        await tx.insert(paymentItem).values(itemValues);
      }
    });

    this.logger.log(`修改付款单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select({ auditStatus: payment.auditStatus })
      .from(payment)
      .where(eq(payment.id, id))
      .limit(1);

    if (existing.length === 0) throw new NotFoundException('付款单不存在');
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(payment).where(eq(payment.id, id));
    this.logger.log(`删除付款单: ${id}`);
  }

  async audit(id: string): Promise<Payment> {
    const result = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, id))
        .limit(1);

      if (rows.length === 0) throw new NotFoundException('付款单不存在');
      if (rows[0].auditStatus === 'audited') {
        throw new BadRequestException('单据已审核');
      }

      const items = await tx
        .select()
        .from(paymentItem)
        .where(eq(paymentItem.paymentId, id));

      // 更新采购入库单已付款、应付款
      for (const item of items) {
        if (!item.inId) continue;
        const amt = Number(item.amount);
        if (amt <= 0) continue;
        const amtStr = String(amt);
        await tx
          .update(purchaseIn)
          .set({
            paidAmount: sql`${purchaseIn.paidAmount} + ${amtStr}::numeric`,
            debtAmount: sql`${purchaseIn.debtAmount} - ${amtStr}::numeric`,
          })
          .where(eq(purchaseIn.id, item.inId));
      }

      const updated = await tx
        .update(payment)
        .set({ auditStatus: 'audited' })
        .where(eq(payment.id, id))
        .returning({ id: payment.id });

      if (updated.length === 0) throw new ConflictException('审核失败');
      return updated[0].id;
    });

    this.logger.log(`审核付款单: ${id}`);
    return this.get(result);
  }

  async unaudit(id: string): Promise<Payment> {
    const result = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, id))
        .limit(1);

      if (rows.length === 0) throw new NotFoundException('付款单不存在');
      if (rows[0].auditStatus !== 'audited') {
        throw new BadRequestException('仅已审核状态可反审核');
      }

      const items = await tx
        .select()
        .from(paymentItem)
        .where(eq(paymentItem.paymentId, id));

      // 回退采购入库单已付款、应付款
      for (const item of items) {
        if (!item.inId) continue;
        const amt = Number(item.amount);
        if (amt <= 0) continue;
        const amtStr = String(amt);
        await tx
          .update(purchaseIn)
          .set({
            paidAmount: sql`${purchaseIn.paidAmount} - ${amtStr}::numeric`,
            debtAmount: sql`${purchaseIn.debtAmount} + ${amtStr}::numeric`,
          })
          .where(eq(purchaseIn.id, item.inId));
      }

      const updated = await tx
        .update(payment)
        .set({ auditStatus: 'draft' })
        .where(eq(payment.id, id))
        .returning({ id: payment.id });

      if (updated.length === 0) throw new ConflictException('反审核失败');
      return updated[0].id;
    });

    this.logger.log(`反审核付款单: ${id}`);
    return this.get(result);
  }

  private async generateNo(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    const prefix = `FK${datePart}`;

    const rows = await this.db
      .select({ paymentNo: payment.paymentNo })
      .from(payment)
      .where(ilike(payment.paymentNo, `${prefix}%`))
      .orderBy(desc(payment.paymentNo))
      .limit(1);

    let seq = 1;
    if (rows.length > 0 && rows[0].paymentNo) {
      const lastSeq = parseInt(rows[0].paymentNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
