import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { BackupService } from './backup.service';
import type { BackupFile, BackupStatus, ClearDataResult } from '@shared/api.interface';

const UPLOAD_DIR = process.env.BACKUP_DIR || '/app/backup';

interface MinimalResponse {
  setHeader(name: string, value: string): void;
}

interface UploadedDump {
  path: string;
  originalname: string;
  size?: number;
}

@Controller('api/system/backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('status')
  async status(): Promise<BackupStatus> {
    return this.backupService.status();
  }

  @Get()
  async list(): Promise<BackupFile[]> {
    return this.backupService.list();
  }

  @Post()
  async create(@Body() body: { tag?: string }): Promise<BackupFile> {
    return this.backupService.create(body?.tag);
  }

  @Get(':name/download')
  async download(
    @Param('name') name: string,
    @Res({ passthrough: true }) res: MinimalResponse,
  ): Promise<StreamableFile> {
    const dir = process.env.BACKUP_DIR || '/app/backup';
    const path = join(dir, name);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    return new StreamableFile(createReadStream(path));
  }

  @Post(':name/restore')
  async restore(@Param('name') name: string): Promise<{ preSnapshot: string; tables: number; message: string }> {
    return this.backupService.restore(name);
  }

  /** 一键清库：清空业务表，保留账号与系统参数 */
  @Post('clear')
  async clear(): Promise<ClearDataResult> {
    return this.backupService.clear();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { dest: UPLOAD_DIR }))
  async upload(@UploadedFile() file?: UploadedDump): Promise<BackupFile> {
    if (!file?.path) throw new BadRequestException('没有收到备份文件');
    if (file.size !== undefined && file.size <= 0) throw new BadRequestException('备份文件是空的');
    return this.backupService.saveUploaded(file.path, file.originalname || 'upload.dump');
  }

  @Delete(':name')
  async remove(@Param('name') name: string): Promise<void> {
    return this.backupService.remove(name);
  }
}
