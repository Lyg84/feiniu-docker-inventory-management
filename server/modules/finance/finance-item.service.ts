import {
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@server/local';
import { eq, desc } from 'drizzle-orm';
import { financeItem } from '@server/database/schema';
import type { FinanceItem } from '@shared/api.interface';

@Injectable()
export class FinanceItemService {
  private readonly logger = new Logger(FinanceItemService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(type?: string): Promise<FinanceItem[]> {
    const rows = type
      ? await this.db
          .select()
          .from(financeItem)
          .where(eq(financeItem.type, type))
          .orderBy(desc(financeItem.createdAt))
      : await this.db
          .select()
          .from(financeItem)
          .orderBy(desc(financeItem.createdAt));

    return rows.map((row) => this.toDto(row));
  }

  async create(data: Partial<FinanceItem> & { name: string; type: string }): Promise<FinanceItem> {
    const inserted = await this.db
      .insert(financeItem)
      .values({
        name: data.name,
        type: data.type,
        remark: data.remark,
      })
      .returning();

    this.logger.log(`创建收支项目: ${data.name}`);
    return this.toDto(inserted[0]);
  }

  async update(id: string, data: Partial<FinanceItem>): Promise<FinanceItem> {
    const existing = await this.db
      .select()
      .from(financeItem)
      .where(eq(financeItem.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('收支项目不存在');
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined) patch.type = data.type;
    if (data.remark !== undefined) patch.remark = data.remark;

    if (Object.keys(patch).length === 0) {
      return this.toDto(existing[0]);
    }

    const updated = await this.db
      .update(financeItem)
      .set(patch)
      .where(eq(financeItem.id, id))
      .returning();

    this.logger.log(`更新收支项目: ${id}`);
    return this.toDto(updated[0]);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db
      .delete(financeItem)
      .where(eq(financeItem.id, id))
      .returning({ id: financeItem.id });

    if (deleted.length === 0) {
      throw new NotFoundException('收支项目不存在');
    }

    this.logger.log(`删除收支项目: ${id}`);
  }

  private toDto(row: typeof financeItem.$inferSelect): FinanceItem {
    return {
      id: row.id,
      name: row.name,
      type: row.type as 'income' | 'expense',
      remark: row.remark ?? undefined,
    };
  }
}
