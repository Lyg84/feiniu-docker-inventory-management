import { Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, ilike, count, desc } from 'drizzle-orm';
import { employee } from '@server/database/schema';
import type { Employee, PageResult } from '@shared/api.interface';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<Employee>> {
    const where = keyword ? [ilike(employee.name, `%${keyword}%`)] : [];
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(employee)
        .where(where.length > 0 ? where[0] : undefined)
        .orderBy(desc(employee.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(employee)
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

  async all(): Promise<Employee[]> {
    const rows = await this.db
      .select()
      .from(employee)
      .orderBy(desc(employee.createdAt));
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<Employee> {
    const rows = await this.db.select().from(employee).where(eq(employee.id, id)).limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('职员不存在');
    }
    return this.toDto(rows[0]);
  }

  async create(data: Partial<Employee> & { name: string }): Promise<Employee> {
    const inserted = await this.db
      .insert(employee)
      .values({
        name: data.name,
        phone: data.phone,
        position: data.position,
        department: data.department,
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建职员: ${data.name}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: Partial<Employee>): Promise<Employee> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.position !== undefined) patch.position = data.position;
    if (data.department !== undefined) patch.department = data.department;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      throw new NotFoundException('未提供可更新字段');
    }

    const updated = await this.db
      .update(employee)
      .set(patch)
      .where(eq(employee.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('职员不存在');
    }

    this.logger.log(`更新职员: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(employee)
      .where(eq(employee.id, id))
      .returning({ id: employee.id });

    if (deleted.length === 0) {
      throw new NotFoundException('职员不存在');
    }

    this.logger.log(`删除职员: ${id}`);
  }

  private toDto(row: typeof employee.$inferSelect): Employee {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone ?? undefined,
      position: row.position ?? undefined,
      department: row.department ?? undefined,
      remark: row.remark ?? undefined,
    };
  }
}
