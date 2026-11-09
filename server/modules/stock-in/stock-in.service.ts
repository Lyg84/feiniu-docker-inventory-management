import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc, and, gte, lt, inArray, sql } from 'drizzle-orm';
import { stockIn, stockInItem, warehouse, product } from '@server/database/schema';
import type { StockIn, PageResult } from '@shared/api.interface';

interface StockInItemInput {
  id?: string;
  productId?: string;
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  sortOrder?: number;
}

interface StockInCreateInput {
  inDate?: string;
  warehouseId?: string;
  remark?: string;
  items?: StockInItemInput[];
}

interface StockInUpdateInput {
  inDate?: string;
  warehouseId?: string;
  remark?: string;
  items?: StockInItemInput[];
}

@Injectable()
export class StockInService {
  private readonly logger = new Logger(StockInService.name);

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
  ): Promise<PageResult<StockIn>> {
    const conditions = [];
    if (keyword) {
      conditions.push(ilike(stockIn.inNo, `%${keyword}%`));
    }
    if (status) {
      conditions.push(eq(stockIn.auditStatus, status));
    }
    if (startDate) {
      conditions.push(gte(stockIn.inDate, startDate));
    }
    if (endDate) {
      conditions.push(lt(stockIn.inDate, endDate));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          id: stockIn.id,
          inNo: stockIn.inNo,
          inDate: stockIn.inDate,
          warehouseId: stockIn.warehouseId,
          warehouseName: warehouse.name,
          totalQty: stockIn.totalQty,
          auditStatus: stockIn.auditStatus,
          remark: stockIn.remark,
          createdAt: stockIn.createdAt,
        })
        .from(stockIn)
        .leftJoin(warehouse, eq(stockIn.warehouseId, warehouse.id))
        .where(where)
        .orderBy(desc(stockIn.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(stockIn)
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

  async get(id: string): Promise<StockIn> {
    const rows = await this.db
      .select({
        id: stockIn.id,
        inNo: stockIn.inNo,
        inDate: stockIn.inDate,
        warehouseId: stockIn.warehouseId,
        warehouseName: warehouse.name,
        totalQty: stockIn.totalQty,
        auditStatus: stockIn.auditStatus,
        remark: stockIn.remark,
        createdAt: stockIn.createdAt,
      })
      .from(stockIn)
      .leftJoin(warehouse, eq(stockIn.warehouseId, warehouse.id))
      .where(eq(stockIn.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('产品进仓单不存在');
    }

    const items = await this.db
      .select()
      .from(stockInItem)
      .where(eq(stockInItem.inId, id))
      .orderBy(stockInItem.sortOrder);

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

  async create(data: StockInCreateInput): Promise<StockIn> {
    const inNo = await this.generateNo();
    const items = data.items ?? [];
    const totalQty = items.reduce((sum: number, item: StockInItemInput) => sum + Number(item.quantity || 0), 0);

    const inserted = await this.db.transaction(async (tx) => {
      const [header] = await tx
        .insert(stockIn)
        .values({
          inNo,
          inDate: data.inDate,
          warehouseId: data.warehouseId,
          totalQty: String(totalQty),
          remark: data.remark,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(stockInItem).values(
          items.map((item: StockInItemInput, idx: number) => ({
            inId: header.id,
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

    this.logger.log(`创建产品进仓单: ${inNo}`);
    return this.get(inserted.id);
  }

  async update(id: string, data: StockInUpdateInput): Promise<StockIn> {
    const existing = await this.db
      .select()
      .from(stockIn)
      .where(eq(stockIn.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('产品进仓单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items;
    const totalQty = items
      ? items.reduce((sum: number, item: StockInItemInput) => sum + Number(item.quantity || 0), 0)
      : undefined;

    await this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (data.inDate !== undefined) patch.inDate = data.inDate;
      if (data.warehouseId !== undefined) patch.warehouseId = data.warehouseId;
      if (data.remark !== undefined) patch.remark = data.remark;
      if (totalQty !== undefined) patch.totalQty = String(totalQty);

      if (Object.keys(patch).length > 0) {
        await tx.update(stockIn).set(patch).where(eq(stockIn.id, id));
      }

      if (items) {
        await tx.delete(stockInItem).where(eq(stockInItem.inId, id));
        if (items.length > 0) {
          await tx.insert(stockInItem).values(
            items.map((item: StockInItemInput, idx: number) => ({
              inId: id,
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

    this.logger.log(`更新产品进仓单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(stockIn)
      .where(eq(stockIn.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('产品进仓单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(stockIn).where(eq(stockIn.id, id));
    this.logger.log(`删除产品进仓单: ${id}`);
  }

  async audit(id: string): Promise<StockIn> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(stockIn)
        .set({ auditStatus: 'audited' })
        .where(eq(stockIn.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} + ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`审核产品进仓单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<StockIn> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(stockIn)
        .set({ auditStatus: 'draft' })
        .where(eq(stockIn.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} - ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`反审核产品进仓单: ${id}`);
    return this.get(id);
  }

  private async generateNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const prefix = `RK${datePart}`;

    const rows = await this.db
      .select({ inNo: stockIn.inNo })
      .from(stockIn)
      .where(ilike(stockIn.inNo, `${prefix}%`))
      .orderBy(desc(stockIn.inNo))
      .limit(1);

    let seq = 1;
    if (rows.length > 0) {
      const lastNo = rows[0].inNo;
      const lastSeq = parseInt(lastNo.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private toDto(row: {
    id: string;
    inNo: string;
    inDate: string;
    warehouseId: string | null;
    warehouseName: string | null;
    totalQty: string | number;
    auditStatus: string | null;
    remark: string | null;
    createdAt: Date;
  }): StockIn {
    return {
      id: row.id,
      inNo: row.inNo,
      inDate: row.inDate,
      warehouseId: row.warehouseId ?? undefined,
      warehouseName: row.warehouseName ?? undefined,
      totalQty: Number(row.totalQty),
      auditStatus: (row.auditStatus as 'draft' | 'audited') ?? 'draft',
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
