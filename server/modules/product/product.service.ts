import { Inject, Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/local';
import { eq, gt, ilike, count, desc, and, or, isNull } from 'drizzle-orm';
import { product, salesDelivery, salesDeliveryItem } from '@server/database/schema';
import type { Product, PageResult, PriceHistory } from '@shared/api.interface';

export interface ImportRowError {
  row: number;
  name?: string;
  reason: string;
}

export interface ImportResult {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
}

function trimOrUndef(value: unknown, maxLen?: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return maxLen ? s.slice(0, maxLen) : s;
}

/** Excel 里常见的 "1,200.5" / "￥1200" 也能吃进来，解析失败按 0 处理 */
function numericString(value: unknown, fallback = '0'): string {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(String(value).replace(/[,\s￥¥$]/g, ''));
  return Number.isFinite(n) && n >= 0 ? String(n) : fallback;
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<Product>> {
    const where = keyword ? [ilike(product.name, `%${keyword}%`)] : [];
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(product)
        .where(where.length > 0 ? where[0] : undefined)
        .orderBy(desc(product.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(product)
        .where(where.length > 0 ? where[0] : undefined),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const usage = await this.usageMap();

    return {
      items: rows.map((row) => this.toDto(row, usage.get(row.id) ?? 0)),
      total,
      page,
      pageSize,
    };
  }

  async all(): Promise<Product[]> {
    const [rows, usage] = await Promise.all([
      this.db.select().from(product).orderBy(desc(product.createdAt)),
      this.usageMap(),
    ]);
    return rows.map((row) => this.toDto(row, usage.get(row.id) ?? 0));
  }

  /** 每个商品在送货单里被用过的次数，用来让常用商品排在下拉前面 */
  private async usageMap(): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ productId: salesDeliveryItem.productId, times: count() })
      .from(salesDeliveryItem)
      .groupBy(salesDeliveryItem.productId);
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (r.productId) map.set(r.productId, Number(r.times ?? 0));
    });
    return map;
  }

  /**
   * 按「名称+规格」找档案，找不到就新建（送货单里手打商品/规格时用）。
   * 规格为空时同时匹配 NULL 和空串，避免同一商品被重复建档。
   */
  async ensureByIdentity(
    name: string,
    spec: string,
    unit?: string,
    price?: number,
  ): Promise<string> {
    const nameVal = (name || '').trim();
    const specVal = (spec || '').trim();
    if (!nameVal) throw new ConflictException('商品名称不能为空');
    const specCond = specVal
      ? eq(product.spec, specVal)
      : or(isNull(product.spec), eq(product.spec, ''));
    const existing = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.name, nameVal), specCond))
      .limit(1);
    if (existing.length > 0) return existing[0].id;

    const inserted = await this.db
      .insert(product)
      .values({
        name: nameVal,
        spec: specVal,
        unit: unit || null,
        price: String(price ?? 0),
        stockQty: '0',
      })
      .returning({ id: product.id });
    this.logger.log(`自动建档商品: ${nameVal}/${specVal || '(无规格)'}`);
    return inserted[0].id;
  }

  async get(id: string): Promise<Product> {
    const rows = await this.db.select().from(product).where(eq(product.id, id)).limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('产品不存在');
    }
    return this.toDto(rows[0]);
  }

  async create(data: Partial<Product> & { name: string }): Promise<Product> {
    const specVal = data.spec ?? '';
    const existing = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.name, data.name), eq(product.spec, specVal)))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('产品名称+规格组合已存在');
    }

    const inserted = await this.db
      .insert(product)
      .values({
        name: data.name,
        spec: data.spec,
        unit: data.unit,
        price: data.price !== undefined ? String(data.price) : '0',
        stockQty: data.stockQty !== undefined ? String(data.stockQty) : '0',
        category: data.category,
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建产品: ${data.name}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: Partial<Product>): Promise<Product> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.spec !== undefined) patch.spec = data.spec;
    if (data.unit !== undefined) patch.unit = data.unit;
    if (data.price !== undefined) patch.price = String(data.price);
    if (data.stockQty !== undefined) patch.stockQty = String(data.stockQty);
    if (data.category !== undefined) patch.category = data.category;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      throw new NotFoundException('未提供可更新字段');
    }

    const updated = await this.db
      .update(product)
      .set(patch)
      .where(eq(product.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('产品不存在');
    }

    this.logger.log(`更新产品: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const refs = await this.db
      .select({ times: count() })
      .from(salesDeliveryItem)
      .where(eq(salesDeliveryItem.productId, id));
    if (Number(refs[0]?.times ?? 0) > 0) {
      throw new ConflictException('该商品已被送货单引用，不能删除');
    }

    const deleted = await this.db
      .delete(product)
      .where(eq(product.id, id))
      .returning({ id: product.id });

    if (deleted.length === 0) {
      throw new NotFoundException('产品不存在');
    }

    this.logger.log(`删除产品: ${id}`);
  }

  async getPriceHistory(
    productName: string,
    customerId: string,
    spec?: string,
  ): Promise<PriceHistory[]> {
    const specFilter =
      spec && spec.trim()
        ? eq(salesDeliveryItem.spec, spec.trim())
        : or(isNull(salesDeliveryItem.spec), eq(salesDeliveryItem.spec, ''));
    const rows = await this.db
      .select({
        orderDate: salesDelivery.orderDate,
        orderNo: salesDelivery.orderNo,
        spec: salesDeliveryItem.spec,
        price: salesDeliveryItem.price,
        quantity: salesDeliveryItem.quantity,
        auditStatus: salesDelivery.auditStatus,
      })
      .from(salesDeliveryItem)
      .innerJoin(salesDelivery, eq(salesDeliveryItem.deliveryId, salesDelivery.id))
      .where(
        and(
          eq(salesDeliveryItem.productName, productName),
          eq(salesDelivery.customerId, customerId),
          gt(salesDeliveryItem.price, '0'),
          specFilter,
        ),
      )
      .orderBy(desc(salesDelivery.orderDate), desc(salesDelivery.createdAt))
      .limit(12);

    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.orderNo)) return false;
        seen.add(row.orderNo);
        return true;
      })
      .slice(0, 5)
      .map((row) => ({
        date: row.orderDate,
        orderNo: row.orderNo,
        spec: row.spec || '',
        audited: row.auditStatus === 'audited',
        price: Number(row.price),
        quantity: Number(row.quantity),
      }));
  }

  /**
   * 批量导入商品。按 名称+规格 去重：库里已存在或文件内重复的都跳过，不覆盖原数据。
   */
  async importMany(rows: Array<Partial<Product> & { name?: string }>): Promise<ImportResult> {
    const errors: ImportRowError[] = [];
    const accepted: Array<{
      name: string;
      spec: string;
      unit?: string;
      price: string;
      stockQty: string;
      category?: string;
      remark?: string;
    }> = [];
    const seen = new Set<string>();

    rows.forEach((raw, idx) => {
      const lineNo = idx + 2; // 表头占第 1 行
      const name = trimOrUndef(raw?.name, 200);
      if (!name) {
        errors.push({ row: lineNo, reason: '商品名称为空' });
        return;
      }
      const spec = trimOrUndef(raw.spec, 200) ?? '';
      const key = `${name}\u0000${spec}`;
      if (seen.has(key)) {
        errors.push({ row: lineNo, name, reason: '文件内重复（名称+规格），已跳过' });
        return;
      }
      seen.add(key);
      accepted.push({
        name,
        spec,
        unit: trimOrUndef(raw.unit, 20),
        price: numericString(raw.price),
        stockQty: numericString(raw.stockQty),
        category: trimOrUndef(raw.category, 100),
        remark: trimOrUndef(raw.remark),
      });
    });

    const existing = await this.db
      .select({ name: product.name, spec: product.spec })
      .from(product);
    const existingKeys = new Set(
      existing.map((r) => `${r.name}\u0000${r.spec ?? ''}`),
    );

    const toInsert = accepted.filter(
      (r) => !existingKeys.has(`${r.name}\u0000${r.spec}`),
    );
    const skipped = accepted.length - toInsert.length;

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      if (chunk.length === 0) continue;
      const res = await this.db.insert(product).values(chunk).returning({ id: product.id });
      inserted += res.length;
    }

    const result: ImportResult = {
      total: rows.length,
      inserted,
      skipped,
      failed: errors.length,
      errors,
    };
    this.logger.log(
      `导入商品: 新增 ${inserted}, 跳过 ${skipped}, 失败 ${errors.length}`,
    );
    return result;
  }

  private toDto(row: typeof product.$inferSelect, usageCount = 0): Product {
    return {
      id: row.id,
      name: row.name,
      spec: row.spec ?? undefined,
      unit: row.unit ?? undefined,
      price: Number(row.price),
      stockQty: Number(row.stockQty),
      category: row.category ?? undefined,
      remark: row.remark ?? undefined,
      createdAt: row.createdAt.toISOString(),
      usageCount,
    };
  }
}
