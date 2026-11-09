import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc, and, gte, lt, sql } from 'drizzle-orm';
import { stockOut, stockOutItem, warehouse, product } from '@server/database/schema';
import type { StockOut, PageResult } from '@shared/api.interface';

interface StockOutItemInput {
  id?: string;
  productId?: string;
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  sortOrder?: number;
}

interface StockOutCreateInput {
  outDate?: string;
  warehouseId?: string;
  remark?: string;
  items?: StockOutItemInput[];
}

interface StockOutUpdateInput {
  outDate?: string;
  warehouseId?: string;
  remark?: string;
  items?: StockOutItemInput[];
}

@Injectable()
export class StockOutService {
  private readonly logger = new Logger(StockOutService.name);

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
  ): Promise<PageResult<StockOut>> {
    const conditions = [];
    if (keyword) {
      conditions.push(ilike(stockOut.outNo, `%${keyword}%`));
    }
    if (status) {
      conditions.push(eq(stockOut.auditStatus, status));
    }
    if (startDate) {
      conditions.push(gte(stockOut.outDate, startDate));
    }
    if (endDate) {
      conditions.push(lt(stockOut.outDate, endDate));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          id: stockOut.id,
          outNo: stockOut.outNo,
          outDate: stockOut.outDate,
          warehouseId: stockOut.warehouseId,
          warehouseName: warehouse.name,
          totalQty: stockOut.totalQty,
          auditStatus: stockOut.auditStatus,
          remark: stockOut.remark,
          createdAt: stockOut.createdAt,
        })
        .from(stockOut)
        .leftJoin(warehouse, eq(stockOut.warehouseId, warehouse.id))
        .where(where)
        .orderBy(desc(stockOut.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(stockOut)
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

  async get(id: string): Promise<StockOut> {
    const rows = await this.db
      .select({
        id: stockOut.id,
        outNo: stockOut.outNo,
        outDate: stockOut.outDate,
        warehouseId: stockOut.warehouseId,
        warehouseName: warehouse.name,
        totalQty: stockOut.totalQty,
        auditStatus: stockOut.auditStatus,
        remark: stockOut.remark,
        createdAt: stockOut.createdAt,
      })
      .from(stockOut)
      .leftJoin(warehouse, eq(stockOut.warehouseId, warehouse.id))
      .where(eq(stockOut.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('产品出仓单不存在');
    }

    const items = await this.db
      .select()
      .from(stockOutItem)
      .where(eq(stockOutItem.outId, id))
      .orderBy(stockOutItem.sortOrder);

    return {
      ...this.toDto(rows[0]),
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId ?? undefined,
        productName: item.productName,
        spec: item.spec ?? undefined,
        unit: item.unit ?? undefined,
        quantity: Number(item.quantity),
        sortOrder: item.sortOrder ?? 0,
      })),
    };
  }

  async create(data: StockOutCreateInput): Promise<StockOut> {
    const outNo = await this.generateNo();
    const items = data.items ?? [];
    const totalQty = items.reduce((sum: number, item: StockOutItemInput) => sum + Number(item.quantity || 0), 0);

    const inserted = await this.db.transaction(async (tx) => {
      const [header] = await tx
        .insert(stockOut)
        .values({
          outNo,
          outDate: data.outDate,
          warehouseId: data.warehouseId,
          totalQty: String(totalQty),
          remark: data.remark,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(stockOutItem).values(
          items.map((item: StockOutItemInput, idx: number) => ({
            outId: header.id,
            productId: item.productId,
            productName: item.productName,
            spec: item.spec,
            unit: item.unit,
            quantity: String(item.quantity),
            sortOrder: item.sortOrder ?? idx,
          })),
        );
      }

      return header;
    });

    this.logger.log(`创建产品出仓单: ${outNo}`);
    return this.get(inserted.id);
  }

  async update(id: string, data: StockOutUpdateInput): Promise<StockOut> {
    const existing = await this.db
      .select()
      .from(stockOut)
      .where(eq(stockOut.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('产品出仓单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items;
    const totalQty = items
      ? items.reduce((sum: number, item: StockOutItemInput) => sum + Number(item.quantity || 0), 0)
      : undefined;

    await this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (data.outDate !== undefined) patch.outDate = data.outDate;
      if (data.warehouseId !== undefined) patch.warehouseId = data.warehouseId;
      if (data.remark !== undefined) patch.remark = data.remark;
      if (totalQty !== undefined) patch.totalQty = String(totalQty);

      if (Object.keys(patch).length > 0) {
        await tx.update(stockOut).set(patch).where(eq(stockOut.id, id));
      }

      if (items) {
        await tx.delete(stockOutItem).where(eq(stockOutItem.outId, id));
        if (items.length > 0) {
          await tx.insert(stockOutItem).values(
            items.map((item: StockOutItemInput, idx: number) => ({
              outId: id,
              productId: item.productId,
              productName: item.productName,
              spec: item.spec,
              unit: item.unit,
              quantity: String(item.quantity),
              sortOrder: item.sortOrder ?? idx,
            })),
          );
        }
      }
    });

    this.logger.log(`更新产品出仓单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(stockOut)
      .where(eq(stockOut.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('产品出仓单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(stockOut).where(eq(stockOut.id, id));
    this.logger.log(`删除产品出仓单: ${id}`);
  }

  async audit(id: string): Promise<StockOut> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(stockOut)
        .set({ auditStatus: 'audited' })
        .where(eq(stockOut.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} - ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`审核产品出仓单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<StockOut> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(stockOut)
        .set({ auditStatus: 'draft' })
        .where(eq(stockOut.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} + ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`反审核产品出仓单: ${id}`);
    return this.get(id);
  }

  private async generateNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const prefix = `CK${datePart}`;

    const rows = await this.db
      .select({ outNo: stockOut.outNo })
      .from(stockOut)
      .where(ilike(stockOut.outNo, `${prefix}%`))
      .orderBy(desc(stockOut.outNo))
      .limit(1);

    let seq = 1;
    if (rows.length > 0) {
      const lastNo = rows[0].outNo;
      const lastSeq = parseInt(lastNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private toDto(row: {
    id: string;
    outNo: string;
    outDate: string;
    warehouseId: string | null;
    warehouseName: string | null;
    totalQty: string | number;
    auditStatus: string | null;
    remark: string | null;
    createdAt: Date;
  }): StockOut {
    return {
      id: row.id,
      outNo: row.outNo,
      outDate: row.outDate,
      warehouseId: row.warehouseId ?? undefined,
      warehouseName: row.warehouseName ?? undefined,
      totalQty: Number(row.totalQty),
      auditStatus: (row.auditStatus as 'draft' | 'audited') ?? 'draft',
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
