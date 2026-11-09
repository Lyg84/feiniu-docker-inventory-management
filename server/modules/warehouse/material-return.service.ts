import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc, and, gte, lt, sql } from 'drizzle-orm';
import {
  materialReturn,
  materialReturnItem,
  warehouse,
  product,
} from '@server/database/schema';
import type { MaterialReturn, PageResult } from '@shared/api.interface';
import { getOrderNoSettings } from '@server/modules/system/order-no-config';

interface MaterialReturnItemInput {
  id?: string;
  productId?: string;
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  sortOrder?: number;
}

interface MaterialReturnCreateInput {
  returnDate?: string;
  warehouseId?: string;
  department?: string;
  remark?: string;
  items?: MaterialReturnItemInput[];
}

interface MaterialReturnUpdateInput {
  returnDate?: string;
  warehouseId?: string;
  department?: string;
  remark?: string;
  items?: MaterialReturnItemInput[];
}

@Injectable()
export class MaterialReturnService {
  private readonly logger = new Logger(MaterialReturnService.name);

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
  ): Promise<PageResult<MaterialReturn>> {
    const conditions = [];
    if (keyword) {
      conditions.push(ilike(materialReturn.returnNo, `%${keyword}%`));
    }
    if (status) {
      conditions.push(eq(materialReturn.auditStatus, status));
    }
    if (startDate) {
      conditions.push(gte(materialReturn.returnDate, startDate));
    }
    if (endDate) {
      conditions.push(lt(materialReturn.returnDate, endDate));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          id: materialReturn.id,
          returnNo: materialReturn.returnNo,
          returnDate: materialReturn.returnDate,
          warehouseId: materialReturn.warehouseId,
          warehouseName: warehouse.name,
          department: materialReturn.department,
          totalQty: materialReturn.totalQty,
          auditStatus: materialReturn.auditStatus,
          remark: materialReturn.remark,
          createdAt: materialReturn.createdAt,
        })
        .from(materialReturn)
        .leftJoin(warehouse, eq(materialReturn.warehouseId, warehouse.id))
        .where(where)
        .orderBy(desc(materialReturn.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(materialReturn)
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

  async get(id: string): Promise<MaterialReturn> {
    const rows = await this.db
      .select({
        id: materialReturn.id,
        returnNo: materialReturn.returnNo,
        returnDate: materialReturn.returnDate,
        warehouseId: materialReturn.warehouseId,
        warehouseName: warehouse.name,
        department: materialReturn.department,
        totalQty: materialReturn.totalQty,
        auditStatus: materialReturn.auditStatus,
        remark: materialReturn.remark,
        createdAt: materialReturn.createdAt,
      })
      .from(materialReturn)
      .leftJoin(warehouse, eq(materialReturn.warehouseId, warehouse.id))
      .where(eq(materialReturn.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('材料退仓单不存在');
    }

    const items = await this.db
      .select()
      .from(materialReturnItem)
      .where(eq(materialReturnItem.returnId, id))
      .orderBy(materialReturnItem.sortOrder);

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

  async create(data: MaterialReturnCreateInput): Promise<MaterialReturn> {
    const returnNo = await this.generateNo();
    const items = data.items ?? [];
    const totalQty = items.reduce(
      (sum: number, item: MaterialReturnItemInput) => sum + Number(item.quantity || 0),
      0,
    );

    const inserted = await this.db.transaction(async (tx) => {
      const [header] = await tx
        .insert(materialReturn)
        .values({
          returnNo,
          returnDate: data.returnDate,
          warehouseId: data.warehouseId,
          department: data.department,
          totalQty: String(totalQty),
          remark: data.remark,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(materialReturnItem).values(
          items.map((item: MaterialReturnItemInput, idx: number) => ({
            returnId: header.id,
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

    this.logger.log(`创建材料退仓单: ${returnNo}`);
    return this.get(inserted.id);
  }

  async update(id: string, data: MaterialReturnUpdateInput): Promise<MaterialReturn> {
    const existing = await this.db
      .select()
      .from(materialReturn)
      .where(eq(materialReturn.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('材料退仓单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items;
    const totalQty = items
      ? items.reduce((sum: number, item: MaterialReturnItemInput) => sum + Number(item.quantity || 0), 0)
      : undefined;

    await this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (data.returnDate !== undefined) patch.returnDate = data.returnDate;
      if (data.warehouseId !== undefined) patch.warehouseId = data.warehouseId;
      if (data.department !== undefined) patch.department = data.department;
      if (data.remark !== undefined) patch.remark = data.remark;
      if (totalQty !== undefined) patch.totalQty = String(totalQty);

      if (Object.keys(patch).length > 0) {
        await tx.update(materialReturn).set(patch).where(eq(materialReturn.id, id));
      }

      if (items) {
        await tx.delete(materialReturnItem).where(eq(materialReturnItem.returnId, id));
        if (items.length > 0) {
          await tx.insert(materialReturnItem).values(
            items.map((item: MaterialReturnItemInput, idx: number) => ({
              returnId: id,
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

    this.logger.log(`更新材料退仓单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(materialReturn)
      .where(eq(materialReturn.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('材料退仓单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(materialReturn).where(eq(materialReturn.id, id));
    this.logger.log(`删除材料退仓单: ${id}`);
  }

  async audit(id: string): Promise<MaterialReturn> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(materialReturn)
        .set({ auditStatus: 'audited' })
        .where(eq(materialReturn.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} + ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`审核材料退仓单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<MaterialReturn> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(materialReturn)
        .set({ auditStatus: 'draft' })
        .where(eq(materialReturn.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} - ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`反审核材料退仓单: ${id}`);
    return this.get(id);
  }

  private async generateNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const prefix = `TL${datePart}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const rows = await this.db
      .select({ returnNo: materialReturn.returnNo })
      .from(materialReturn)
      .where(ilike(materialReturn.returnNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${materialReturn.returnNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (rows.length > 0) {
      const lastNo = rows[0].returnNo;
      const lastSeq = parseInt(lastNo.slice(10), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(cfg.digits, '0')}`;
  }

  private toDto(row: {
    id: string;
    returnNo: string;
    returnDate: string;
    warehouseId: string | null;
    warehouseName: string | null;
    department: string | null;
    totalQty: string | number;
    auditStatus: string | null;
    remark: string | null;
    createdAt: Date;
  }): MaterialReturn {
    return {
      id: row.id,
      returnNo: row.returnNo,
      returnDate: row.returnDate,
      warehouseId: row.warehouseId ?? undefined,
      warehouseName: row.warehouseName ?? undefined,
      department: row.department ?? undefined,
      totalQty: Number(row.totalQty),
      auditStatus: (row.auditStatus as 'draft' | 'audited') ?? 'draft',
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
