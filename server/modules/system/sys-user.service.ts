import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/local';
import { eq, ilike, count, desc } from 'drizzle-orm';
import { sysUser } from '@server/database/schema';
import type { SysUser, PageResult } from '@shared/api.interface';

function toDto(row: typeof sysUser.$inferSelect): SysUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name ?? undefined,
    role: row.role ?? 'user',
    status: row.status ?? 'active',
  };
}

@Injectable()
export class SysUserService {
  private readonly logger = new Logger(SysUserService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<PageResult<SysUser>> {
    const offset = (page - 1) * pageSize;
    const whereClause = keyword ? ilike(sysUser.username, `%${keyword}%`) : undefined;

    const base = this.db.select().from(sysUser);
    const query = whereClause ? base.where(whereClause) : base;

    const [rows, totalRows] = await Promise.all([
      query.orderBy(desc(sysUser.createdAt)).limit(pageSize).offset(offset),
      this.db.select({ count: count() }).from(sysUser).where(whereClause ?? undefined),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    return {
      items: rows.map((row: typeof sysUser.$inferSelect) => toDto(row)),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<SysUser> {
    const rows = await this.db.select().from(sysUser).where(eq(sysUser.id, id));
    if (rows.length === 0) throw new NotFoundException('用户不存在');
    return toDto(rows[0]);
  }

  async create(data: { username: string; password: string; name?: string; role?: string; status?: string }): Promise<SysUser> {
    // check duplicate
    const existing = await this.db.select().from(sysUser).where(eq(sysUser.username, data.username));
    if (existing.length > 0) {
      throw new BadRequestException('用户名已存在');
    }
    const inserted = await this.db.insert(sysUser).values({
      username: data.username,
      password: data.password,
      name: data.name ?? null,
      role: data.role ?? 'user',
      status: data.status ?? 'active',
    }).returning();
    this.logger.log(`SysUser created: username=${data.username}`);
    return toDto(inserted[0]);
  }

  async update(id: string, data: Partial<{ name: string; role: string; status: string; password: string }>): Promise<SysUser> {
    const patch: Partial<typeof sysUser.$inferInsert> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.role !== undefined) patch.role = data.role;
    if (data.status !== undefined) patch.status = data.status;
    if (data.password !== undefined) patch.password = data.password;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.db.update(sysUser).set(patch).where(eq(sysUser.id, id)).returning();
    if (updated.length === 0) throw new NotFoundException('用户不存在');
    this.logger.log(`SysUser updated: id=${id}`);
    return toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db.delete(sysUser).where(eq(sysUser.id, id)).returning({ id: sysUser.id });
    if (deleted.length === 0) throw new NotFoundException('用户不存在');
    this.logger.log(`SysUser deleted: id=${id}`);
  }
}
