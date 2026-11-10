import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackupFile, BackupStatus, ClearDataResult } from '@shared/api.interface';

const execFileAsync = promisify(execFile);

interface DbConn {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/** 备份目录固定在容器里的挂载点，宿主对应 /vol1/1000/jxc/backup */
const DEFAULT_DIR = '/app/backup';
/** 单文件下载上限 200MB，够一份完整库备份 */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
/** 清库时保留的表：账号与系统参数，清掉就没人能登录了 */
const CLEAR_KEEP = ['sys_user', 'sys_param'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly dir = process.env.BACKUP_DIR || DEFAULT_DIR;

  /** 从 DATABASE_URL 里拆出 pg_dump / pg_restore 需要的连接参数 */
  private conn(): DbConn {
    const raw = process.env.DATABASE_URL || '';
    if (!raw) throw new BadRequestException('环境变量 DATABASE_URL 未配置');
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw new BadRequestException('DATABASE_URL 格式不合法');
    }
    return {
      host: u.hostname || 'db',
      port: u.port || '5432',
      user: decodeURIComponent(u.username || 'jxc'),
      password: decodeURIComponent(u.password || ''),
      database: decodeURIComponent(u.pathname.replace(/^\//, '') || 'jxc'),
    };
  }

  private pgEnv(): NodeJS.ProcessEnv {
    return { ...process.env, PGPASSWORD: this.conn().password };
  }

  private stamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  /** 只接受简单文件名，挡住路径穿越 */
  private assertName(name: string): string {
    if (!/^[A-Za-z0-9_.-]+\.dump$/.test(name)) {
      throw new BadRequestException('备份文件名不合法（只允许字母、数字、下划线、点、短横线，后缀 .dump）');
    }
    return join(this.dir, name);
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private async toDto(name: string, size: number, mtimeMs: number): Promise<BackupFile> {
    return {
      name,
      size,
      createdAt: new Date(mtimeMs).toISOString(),
      kind: name.startsWith('pre-restore')
        ? 'pre-restore'
        : name.startsWith('pre-clear')
          ? 'pre-clear'
          : name.startsWith('upload')
            ? 'upload'
            : 'manual',
    };
  }

  /** 备份能力自检：镜像里有没有 pg_dump，连的是哪个库 */
  async status(): Promise<BackupStatus> {
    const c = this.conn();
    let available = false;
    let version = '';
    try {
      const { stdout } = await execFileAsync('pg_dump', ['--version'], { timeout: 10000 });
      version = stdout.trim();
      available = true;
    } catch {
      available = false;
    }
    return { available, version, dir: this.dir, database: c.database, host: c.host };
  }

  async list(): Promise<BackupFile[]> {
    await this.ensureDir();
    const names = (await readdir(this.dir)).filter((n) => n.endsWith('.dump'));
    const rows: BackupFile[] = [];
    for (const n of names) {
      const st = await stat(join(this.dir, n)).catch(() => null);
      if (!st) continue;
      rows.push(await this.toDto(n, st.size, st.mtimeMs));
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows;
  }

  /** 立即备份：pg_dump -Fc 自定义格式，可直接 pg_restore 选择性恢复 */
  async create(tag?: string): Promise<BackupFile> {
    await this.ensureDir();
    const c = this.conn();
    const prefix = tag && /^[A-Za-z0-9_-]+$/.test(tag) ? tag : 'jxc';
    let name = `${prefix}_${this.stamp()}.dump`;
    let target = join(this.dir, name);
    let exists = await stat(target).then(
      () => true,
      () => false,
    );
    if (exists) {
      name = `${prefix}_${this.stamp()}${pad(new Date().getSeconds())}.dump`;
      target = join(this.dir, name);
      exists = await stat(target).then(
        () => true,
        () => false,
      );
      if (exists) throw new ConflictException('同一分钟内已存在同名备份，请稍后再试');
    }

    const args = ['-h', c.host, '-p', c.port, '-U', c.user, '-Fc', '-f', target, c.database];
    try {
      await execFileAsync('pg_dump', args, { env: this.pgEnv(), timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
    } catch (err) {
      await unlink(target).catch(() => undefined);
      const msg = (err as { stderr?: string; message?: string }).stderr || (err as Error).message;
      this.logger.error(`备份失败: ${msg}`);
      throw new ConflictException(`备份失败：${msg}`);
    }
    const st = await stat(target);
    this.logger.log(`备份完成: ${name} (${st.size} 字节)`);
    return this.toDto(name, st.size, st.mtimeMs);
  }

  private async countTables(): Promise<number> {
    const c = this.conn();
    try {
      const { stdout } = await execFileAsync(
        'psql',
        ['-h', c.host, '-p', c.port, '-U', c.user, '-d', c.database, '-t', '-A', '-c',
          "select count(*) from information_schema.tables where table_schema='public'"],
        { env: this.pgEnv(), timeout: 30000 },
      );
      const n = Number(stdout.trim());
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  /** 用一份 .dump 覆盖当前库：先自动做还原前快照，再单事务还原 */
  async restore(name: string): Promise<{ preSnapshot: string; tables: number; message: string }> {
    const c = this.conn();
    const target = this.assertName(name);
    const exists = await stat(target).then(
      () => true,
      () => false,
    );
    if (!exists) throw new NotFoundException(`备份文件不存在：${name}`);

    const pre = await this.create('pre-restore');
    const args = [
      '-h', c.host, '-p', c.port, '-U', c.user, '-d', c.database,
      '--clean', '--if-exists', '--no-owner', '--single-transaction', target,
    ];
    try {
      await execFileAsync('pg_restore', args, { env: this.pgEnv(), timeout: 600000, maxBuffer: 20 * 1024 * 1024 });
    } catch (err) {
      const detail = (err as { stderr?: string }).stderr || (err as Error).message;
      this.logger.error(`还原失败: ${detail}`);
      throw new ConflictException(
        `还原失败，事务已回滚，当前数据未变。还原前快照：${pre.name}。详情：${detail}`,
      );
    }
    const tables = await this.countTables();
    this.logger.log(`还原完成: ${name}（表 ${tables} 张，还原前快照 ${pre.name}）`);
    return {
      preSnapshot: pre.name,
      tables,
      message: `已用 ${name} 覆盖当前库，表 ${tables} 张。如页面显示异常，刷新浏览器即可。`,
    };
  }

  /** 保存浏览器上传的备份文件到备份目录（不自动还原，交给用户再点一次） */
  async saveUploaded(tmpPath: string, originalName: string): Promise<BackupFile> {
    await this.ensureDir();
    const base = originalName.replace(/[^A-Za-z0-9_.-]/g, '_');
    const safe = base.endsWith('.dump') ? base : `${base}.dump`;
    const name = `upload_${this.stamp()}_${safe}`;
    const dest = this.assertName(name);
    const { rename, stat: statFn, copyFile } = await import('node:fs/promises');
    try {
      await rename(tmpPath, dest);
    } catch {
      await copyFile(tmpPath, dest);
    }
    const st = await statFn(dest);
    const size = st.size;
    if (size > MAX_UPLOAD_BYTES) {
      await unlink(dest).catch(() => undefined);
      throw new BadRequestException('备份文件超过 200MB 上限');
    }
    return this.toDto(name, size, st.mtimeMs);
  }

  /** 跑一条 SQL，返回裸文本结果（-t -A，无表头无对齐） */
  private async psql(sql: string): Promise<string> {
    const c = this.conn();
    const { stdout } = await execFileAsync(
      'psql',
      ['-h', c.host, '-p', c.port, '-U', c.user, '-d', c.database, '-t', '-A', '-c', sql],
      { env: this.pgEnv(), timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    );
    return stdout.trim();
  }

  /** 公共 schema 下的业务表（排除账号表与参数表，否则清完就登不进来了） */
  private async businessTables(): Promise<string[]> {
    const raw = await this.psql(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
    );
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((t) => !CLEAR_KEEP.includes(t));
  }

  private async rowCounts(tables: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const t of tables) {
      out[t] = Number(await this.psql(`select count(*) from "${t}"`)) || 0;
    }
    return out;
  }

  /** 一键清库：先自动快照，再把业务表整体 TRUNCATE（保留账号与系统参数） */
  async clear(): Promise<ClearDataResult> {
    const tables = await this.businessTables();
    if (tables.length === 0) throw new BadRequestException('没有可清理的业务表');
    const before = await this.rowCounts(tables);
    const pre = await this.create('pre-clear');
    try {
      await this.psql(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    } catch (err) {
      const detail = (err as { stderr?: string; message?: string }).stderr || (err as Error).message;
      this.logger.error(`清库失败: ${detail}`);
      throw new ConflictException(`清库失败，数据未变动。清库前快照：${pre.name}。详情：${detail}`);
    }
    const after = await this.rowCounts(tables);
    const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);
    this.logger.log(`清库完成：${tables.length} 张表，共清掉 ${totalBefore} 行（快照 ${pre.name}）`);
    return {
      preSnapshot: pre.name,
      before,
      after,
      message: `已清空 ${tables.length} 张业务表、共 ${totalBefore} 行数据，账号与系统参数保留。清库前快照：${pre.name}`,
    };
  }

  async remove(name: string): Promise<void> {
    const target = this.assertName(name);
    try {
      await unlink(target);
    } catch {
      throw new NotFoundException(`备份文件不存在：${name}`);
    }
    this.logger.log(`删除备份: ${name}`);
  }
}
