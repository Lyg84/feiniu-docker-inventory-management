import { Controller, Get, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 打印客户端插件目录：容器内挂载宿主机的 ./downloads，由 sync-hiprint.sh 定时同步 */
const PLUGIN_DIR = process.env.PRINT_PLUGIN_DIR || '/app/downloads';
const META_FILE = 'hiprint.json';

export interface PrintPluginMeta {
  available: boolean;
  version?: string;
  fileName?: string;
  size?: number;
  sha256?: string;
  syncedAt?: string;
  upstreamUrl?: string;
}

interface MetaFile {
  version?: string;
  fileName?: string;
  size?: number;
  sha256?: string;
  syncedAt?: string;
  upstreamUrl?: string;
}

@Controller('api/print-plugin')
export class PrintPluginController {
  private readonly logger = new Logger(PrintPluginController.name);

  private readMeta(): MetaFile | null {
    const path = join(PLUGIN_DIR, META_FILE);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as MetaFile;
    } catch {
      return null;
    }
  }

  private resolveFile(meta: MetaFile | null): string | null {
    if (!meta?.fileName) return null;
    const base = meta.fileName.replace(/[\\/]/g, '');
    const path = join(PLUGIN_DIR, base);
    return existsSync(path) ? path : null;
  }

  @Get('meta')
  meta(): PrintPluginMeta {
    const stored = this.readMeta();
    const file = this.resolveFile(stored);
    if (!stored || !file) {
      return { available: false, upstreamUrl: stored?.upstreamUrl || undefined };
    }
    const info = statSync(file);
    return {
      available: true,
      version: stored.version || '',
      fileName: stored.fileName || '',
      size: info.size,
      sha256: stored.sha256 || '',
      syncedAt: stored.syncedAt || '',
      upstreamUrl: stored.upstreamUrl || '',
    };
  }

  @Get('file')
  file(@Res() res: Response): void {
    const stored = this.readMeta();
    const path = this.resolveFile(stored);
    if (!stored || !path) {
      this.logger.warn('打印插件尚未同步，下载请求被拒绝');
      res.status(404).json({ message: '插件包还没有同步到服务器' });
      return;
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(stored.fileName || 'hiprint.exe').replace(/"/g, '')}"`,
    );
    res.sendFile(path);
  }
}
