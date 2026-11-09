import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import { sysUser } from '@server/database/schema';
import type { SysUser } from '@shared/api.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async login(username: string, password: string): Promise<{ success: boolean; message?: string; user?: SysUser }> {
    const users = await this.db.select().from(sysUser).where(eq(sysUser.username, username));
    if (users.length === 0) {
      this.logger.log(`Login failed: user not found, username=${username}`);
      return { success: false, message: '用户名或密码错误' };
    }
    const user = users[0];
    if (user.password !== password) {
      this.logger.log(`Login failed: wrong password, username=${username}`);
      return { success: false, message: '用户名或密码错误' };
    }
    if (user.status !== 'active') {
      this.logger.log(`Login failed: user inactive, username=${username}`);
      return { success: false, message: '账户已被禁用' };
    }
    const result: SysUser = {
      id: user.id,
      username: user.username,
      name: user.name ?? undefined,
      role: user.role ?? 'user',
      status: user.status ?? 'active',
    };
    this.logger.log(`Login success, username=${username}`);
    return { success: true, user: result };
  }

  async changePassword(oldPassword: string, newPassword: string, username?: string): Promise<{ success: boolean; message?: string }> {
    if (!username) {
      return { success: false, message: '用户名不能为空' };
    }
    const users = await this.db.select().from(sysUser).where(eq(sysUser.username, username));
    if (users.length === 0) {
      return { success: false, message: '用户不存在' };
    }
    const user = users[0];
    if (user.password !== oldPassword) {
      return { success: false, message: '原密码错误' };
    }
    await this.db.update(sysUser).set({ password: newPassword }).where(eq(sysUser.id, user.id));
    this.logger.log(`Password changed, username=${username}`);
    return { success: true };
  }
}
