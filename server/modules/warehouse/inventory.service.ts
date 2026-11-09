import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc, and, or } from 'drizzle-orm';
import { product } from '@server/database/schema';
import type { Product, PageResult } from '@shared/api.interface';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(
    page: number,
    pageSize: number,
    keyword?: string,
    warehouseId?: string,
  ): Promise<PageResult<Product>> {
    const conditions = [];
    if (keyword) {
      conditions.push(
        or(
          ilike(product.name, `%${keyword}%`),
          ilike(product.spec, `%${keyword}%`),
        ),
      );
    }
    // 简化版：不按仓库分库存，直接读 product.stock_qty
    // warehouseId 参数预留，当前不参与过滤
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(product)
        .where(where)
        .orderBy(desc(product.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(product)
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

  private toDto(row: typeof product.$inferSelect): Product {
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
    };
  }
}
