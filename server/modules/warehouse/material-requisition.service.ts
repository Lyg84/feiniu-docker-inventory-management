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
  materialRequisition,
  materialRequisitionItem,
  warehouse,
  product,
} from '@server/database/schema';
import type { MaterialRequisition, PageResult } from '@shared/api.interface';
import { getOrderNoSettings } from '@server/modules/system/order-no-config';

interface MaterialReqItemInput {
  id?: string;
  productId?: string;
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  sortOrder?: number;
}

interface MaterialReqCreateInput {
  reqDate?: string;
  warehouseId?: string;
  department?: string;
  applicant?: string;
  remark?: string;
  items?: MaterialReqItemInput[];
}

interface MaterialReqUpdateInput {
  reqDate?: string;
  warehouseId?: string;
  department?: string;
  applicant?: string;
  remark?: string;
  items?: MaterialReqItemInput[];
}

@Injectable()
export class MaterialRequisitionService {
  private readonly logger = new Logger(MaterialRequisitionService.name);

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
  ): Promise<PageResult<MaterialRequisition>> {
    const conditions = [];
    if (keyword) {
      conditions.push(ilike(materialRequisition.reqNo, `%${keyword}%`));
    }
    if (status) {
      conditions.push(eq(materialRequisition.auditStatus, status));
    }
    if (startDate) {
      conditions.push(gte(materialRequisition.reqDate, startDate));
    }
    if (endDate) {
      conditions.push(lt(materialRequisition.reqDate, endDate));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          id: materialRequisition.id,
          reqNo: materialRequisition.reqNo,
          reqDate: materialRequisition.reqDate,
          warehouseId: materialRequisition.warehouseId,
          warehouseName: warehouse.name,
          department: materialRequisition.department,
          applicant: materialRequisition.applicant,
          totalQty: materialRequisition.totalQty,
          auditStatus: materialRequisition.auditStatus,
          remark: materialRequisition.remark,
          createdAt: materialRequisition.createdAt,
        })
        .from(materialRequisition)
        .leftJoin(warehouse, eq(materialRequisition.warehouseId, warehouse.id))
        .where(where)
        .orderBy(desc(materialRequisition.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(materialRequisition)
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

  async get(id: string): Promise<MaterialRequisition> {
    const rows = await this.db
      .select({
        id: materialRequisition.id,
        reqNo: materialRequisition.reqNo,
        reqDate: materialRequisition.reqDate,
        warehouseId: materialRequisition.warehouseId,
        warehouseName: warehouse.name,
        department: materialRequisition.department,
        applicant: materialRequisition.applicant,
        totalQty: materialRequisition.totalQty,
        auditStatus: materialRequisition.auditStatus,
        remark: materialRequisition.remark,
        createdAt: materialRequisition.createdAt,
      })
      .from(materialRequisition)
      .leftJoin(warehouse, eq(materialRequisition.warehouseId, warehouse.id))
      .where(eq(materialRequisition.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('材料领用单不存在');
    }

    const items = await this.db
      .select()
      .from(materialRequisitionItem)
      .where(eq(materialRequisitionItem.reqId, id))
      .orderBy(materialRequisitionItem.sortOrder);

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

  async create(data: MaterialReqCreateInput): Promise<MaterialRequisition> {
    const reqNo = await this.generateNo();
    const items = data.items ?? [];
    const totalQty = items.reduce(
      (sum: number, item: MaterialReqItemInput) => sum + Number(item.quantity || 0),
      0,
    );

    const inserted = await this.db.transaction(async (tx) => {
      const [header] = await tx
        .insert(materialRequisition)
        .values({
          reqNo,
          reqDate: data.reqDate,
          warehouseId: data.warehouseId,
          department: data.department,
          applicant: data.applicant,
          totalQty: String(totalQty),
          remark: data.remark,
        })
        .returning();

      if (items.length > 0) {
        await tx.insert(materialRequisitionItem).values(
          items.map((item: MaterialReqItemInput, idx: number) => ({
            reqId: header.id,
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

    this.logger.log(`创建材料领用单: ${reqNo}`);
    return this.get(inserted.id);
  }

  async update(id: string, data: MaterialReqUpdateInput): Promise<MaterialRequisition> {
    const existing = await this.db
      .select()
      .from(materialRequisition)
      .where(eq(materialRequisition.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('材料领用单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可修改');
    }

    const items = data.items;
    const totalQty = items
      ? items.reduce((sum: number, item: MaterialReqItemInput) => sum + Number(item.quantity || 0), 0)
      : undefined;

    await this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (data.reqDate !== undefined) patch.reqDate = data.reqDate;
      if (data.warehouseId !== undefined) patch.warehouseId = data.warehouseId;
      if (data.department !== undefined) patch.department = data.department;
      if (data.applicant !== undefined) patch.applicant = data.applicant;
      if (data.remark !== undefined) patch.remark = data.remark;
      if (totalQty !== undefined) patch.totalQty = String(totalQty);

      if (Object.keys(patch).length > 0) {
        await tx.update(materialRequisition).set(patch).where(eq(materialRequisition.id, id));
      }

      if (items) {
        await tx.delete(materialRequisitionItem).where(eq(materialRequisitionItem.reqId, id));
        if (items.length > 0) {
          await tx.insert(materialRequisitionItem).values(
            items.map((item: MaterialReqItemInput, idx: number) => ({
              reqId: id,
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

    this.logger.log(`更新材料领用单: ${id}`);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(materialRequisition)
      .where(eq(materialRequisition.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('材料领用单不存在');
    }
    if (existing[0].auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可删除');
    }

    await this.db.delete(materialRequisition).where(eq(materialRequisition.id, id));
    this.logger.log(`删除材料领用单: ${id}`);
  }

  async audit(id: string): Promise<MaterialRequisition> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'draft') {
      throw new BadRequestException('仅草稿状态可审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(materialRequisition)
        .set({ auditStatus: 'audited' })
        .where(eq(materialRequisition.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} - ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`审核材料领用单: ${id}`);
    return this.get(id);
  }

  async unaudit(id: string): Promise<MaterialRequisition> {
    const existing = await this.get(id);
    if (existing.auditStatus !== 'audited') {
      throw new BadRequestException('仅已审核状态可反审核');
    }

    const items = existing.items ?? [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(materialRequisition)
        .set({ auditStatus: 'draft' })
        .where(eq(materialRequisition.id, id));

      for (const item of items) {
        if (item.productId && item.quantity > 0) {
          await tx
            .update(product)
            .set({ stockQty: sql`${product.stockQty} + ${item.quantity}` })
            .where(eq(product.id, item.productId));
        }
      }
    });

    this.logger.log(`反审核材料领用单: ${id}`);
    return this.get(id);
  }

  private async generateNo(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePart = `${y}${m}${d}`;
    const prefix = `LY${datePart}`;
    // 单据号按月连续编号：当月范围内取最大流水号
    const monthPrefix = prefix.slice(0, 8);
    const cfg = await getOrderNoSettings(this.db);

    const rows = await this.db
      .select({ reqNo: materialRequisition.reqNo })
      .from(materialRequisition)
      .where(ilike(materialRequisition.reqNo, `${monthPrefix}%`))
      .orderBy(desc(sql`(substring(${materialRequisition.reqNo} from 11))::int`))
      .limit(1);

    let seq = cfg.start;
    if (rows.length > 0) {
      const lastNo = rows[0].reqNo;
      const lastSeq = parseInt(lastNo.slice(10), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(cfg.digits, '0')}`;
  }

  private toDto(row: {
    id: string;
    reqNo: string;
    reqDate: string;
    warehouseId: string | null;
    warehouseName: string | null;
    department: string | null;
    applicant: string | null;
    totalQty: string | number;
    auditStatus: string | null;
    remark: string | null;
    createdAt: Date;
  }): MaterialRequisition {
    return {
      id: row.id,
      reqNo: row.reqNo,
      reqDate: row.reqDate,
      warehouseId: row.warehouseId ?? undefined,
      warehouseName: row.warehouseName ?? undefined,
      department: row.department ?? undefined,
      applicant: row.applicant ?? undefined,
      totalQty: Number(row.totalQty),
      auditStatus: (row.auditStatus as 'draft' | 'audited') ?? 'draft',
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
