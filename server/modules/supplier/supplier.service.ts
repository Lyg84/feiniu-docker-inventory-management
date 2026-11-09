import { Inject, Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc } from 'drizzle-orm';
import { supplier } from '@server/database/schema';
import type { Supplier, PageResult } from '@shared/api.interface';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<Supplier>> {
    const where = keyword ? [ilike(supplier.name, `%${keyword}%`)] : [];
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(supplier)
        .where(where.length > 0 ? where[0] : undefined)
        .orderBy(desc(supplier.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(supplier)
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

  async all(): Promise<Supplier[]> {
    const rows = await this.db
      .select()
      .from(supplier)
      .orderBy(desc(supplier.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<Supplier> {
    const rows = await this.db.select().from(supplier).where(eq(supplier.id, id)).limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('供应商不存在');
    }
    return this.toDto(rows[0]);
  }

  async create(data: Partial<Supplier> & { name: string }): Promise<Supplier> {
    const existing = await this.db
      .select({ id: supplier.id })
      .from(supplier)
      .where(eq(supplier.name, data.name))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException('供应商名称已存在');
    }

    const inserted = await this.db
      .insert(supplier)
      .values({
        name: data.name,
        contactPerson: data.contactPerson,
        phone: data.phone,
        address: data.address,
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建供应商: ${data.name}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.contactPerson !== undefined) patch.contactPerson = data.contactPerson;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.address !== undefined) patch.address = data.address;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      throw new NotFoundException('未提供可更新字段');
    }

    const updated = await this.db
      .update(supplier)
      .set(patch)
      .where(eq(supplier.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('供应商不存在');
    }

    this.logger.log(`更新供应商: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(supplier)
      .where(eq(supplier.id, id))
      .returning({ id: supplier.id });

    if (deleted.length === 0) {
      throw new NotFoundException('供应商不存在');
    }

    this.logger.log(`删除供应商: ${id}`);
  }

  private toDto(row: typeof supplier.$inferSelect): Supplier {
    return {
      id: row.id,
      name: row.name,
      contactPerson: row.contactPerson ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      remark: row.remark ?? undefined,
    };
  }
}
