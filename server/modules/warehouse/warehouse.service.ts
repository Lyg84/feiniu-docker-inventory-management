import { Inject, Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc } from 'drizzle-orm';
import { warehouse } from '@server/database/schema';
import type { Warehouse, PageResult } from '@shared/api.interface';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<Warehouse>> {
    const where = keyword ? [ilike(warehouse.name, `%${keyword}%`)] : [];
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(warehouse)
        .where(where.length > 0 ? where[0] : undefined)
        .orderBy(desc(warehouse.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(warehouse)
        .where(where.length > 0 ? where[0] : undefined),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      page,
      pageSize,
    };
  }

  async all(): Promise<Warehouse[]> {
    const rows = await this.db
      .select()
      .from(warehouse)
      .orderBy(desc(warehouse.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<Warehouse> {
    const rows = await this.db.select().from(warehouse).where(eq(warehouse.id, id)).limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('仓库不存在');
    }
    return this.toDto(rows[0]);
  }

  async create(data: Partial<Warehouse> & { name: string }): Promise<Warehouse> {
    const existing = await this.db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(eq(warehouse.name, data.name))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('仓库名称已存在');
    }

    const inserted = await this.db
      .insert(warehouse)
      .values({
        name: data.name,
        address: data.address,
        manager: data.manager,
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建仓库: ${data.name}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: Partial<Warehouse>): Promise<Warehouse> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.address !== undefined) patch.address = data.address;
    if (data.manager !== undefined) patch.manager = data.manager;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      throw new NotFoundException('未提供可更新字段');
    }

    const updated = await this.db
      .update(warehouse)
      .set(patch)
      .where(eq(warehouse.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('仓库不存在');
    }

    this.logger.log(`更新仓库: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(warehouse)
      .where(eq(warehouse.id, id))
      .returning({ id: warehouse.id });

    if (deleted.length === 0) {
      throw new NotFoundException('仓库不存在');
    }

    this.logger.log(`删除仓库: ${id}`);
  }

  private toDto(row: typeof warehouse.$inferSelect): Warehouse {
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? undefined,
      manager: row.manager ?? undefined,
      remark: row.remark ?? undefined,
    };
  }
}
