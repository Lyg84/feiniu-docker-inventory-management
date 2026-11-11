import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, type TableColumnsType } from 'antd';
import {
  Database,
  Download,
  HardDriveDownload,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  AlertTriangle,
  Eraser,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { systemApi } from '@client/src/api';
import type { BackupFile, BackupStatus } from '@shared/api.interface';

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const KIND_LABEL: Record<BackupFile['kind'], string> = {
  manual: '手动备份',
  'pre-restore': '还原前快照',
  'pre-clear': '清库前快照',
  upload: '上传的备份',
};

export default function SystemBackupPage() {
  const [list, setList] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BackupFile | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, st] = await Promise.all([systemApi.backupList(), systemApi.backupStatus()]);
      setList(rows);
      setStatus(st);
    } catch {
      toast.error('读取备份列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const file = await systemApi.backupCreate();
      toast.success(`备份完成：${file.name}（${formatSize(file.size)}）`);
      await fetchData();
    } catch {
      toast.error('备份失败，请查看服务日志');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = (record: BackupFile) => {
    const a = document.createElement('a');
    a.href = systemApi.backupDownloadUrl(record.name);
    a.download = record.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    const target = pendingRestore;
    setPendingRestore(null);
    setBusy(true);
    try {
      const res = await systemApi.backupRestore(target.name);
      toast.success(res.message);
      toast.success(`还原前快照已保存：${res.preSnapshot}`);
    } catch {
      toast.error('还原失败，当前数据未变（失败时事务会回滚）');
    } finally {
      setBusy(false);
      await fetchData();
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setBusy(true);
    try {
      await systemApi.backupRemove(target.name);
      toast.success('已删除');
    } catch {
      toast.error('删除失败');
    } finally {
      setBusy(false);
      await fetchData();
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleClear = async () => {
    setClearOpen(false);
    setBusy(true);
    try {
      const res = await systemApi.backupClear();
      toast.success(res.message);
      await fetchData();
    } catch {
      toast.error('清库失败，数据未变动（失败时事务会回滚）');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.dump')) {
      toast.error('请选择 .dump 格式的备份文件（本系统备份生成的就是这个格式）');
      return;
    }
    setBusy(true);
    try {
      const saved = await systemApi.backupUpload(file);
      toast.success(`上传成功：${saved.name}（${formatSize(saved.size)}）`);
      await fetchData();
    } catch {
      toast.error('上传失败（文件是否超过 200MB？）');
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumnsType<BackupFile> = [
    { title: '备份文件', dataIndex: 'name', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'kind',
      width: 110,
      render: (v: BackupFile['kind']) => KIND_LABEL[v] ?? v,
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (v: number) => formatSize(v),
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => formatTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: BackupFile) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownload(record)}>
            <Download className="w-3 h-3" />
            下载
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPendingRestore(record)}>
            <RotateCcw className="w-3 h-3" />
            还原
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPendingDelete(record)}>
            <Trash2 className="w-3 h-3" />
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-blue-700" />
          <span className="text-base font-semibold text-gray-800">备份还原</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleCreate} disabled={busy || status?.available === false}>
            <HardDriveDownload className="w-3 h-3" />
            {busy ? '处理中…' : '立即备份'}
          </Button>
          <Button size="sm" variant="outline" onClick={handlePickFile} disabled={busy}>
            <Upload className="w-3 h-3" />
            上传备份
          </Button>
          <Button size="sm" variant="outline" onClick={() => setClearOpen(true)} disabled={busy}>
            <Eraser className="w-3 h-3" />
            一键清库
          </Button>
          <Button size="sm" variant="outline" onClick={() => void fetchData()} disabled={busy}>
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
        </div>
      </div>

      <div className="p-3 text-xs text-gray-500 space-y-1 border-b border-gray-200 bg-gray-50">
        {status?.available === false ? (
          <div className="text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            当前镜像里没有 pg_dump，无法在页面备份／还原（镜像需带 postgresql-client）
          </div>
        ) : (
          <div>
            备份方式：pg_dump 自定义格式（.dump），存放在容器内 <code>{status?.dir || '/app/backup'}</code>
            {status?.version ? `，客户端 ${status.version}` : ''}
          </div>
        )}
        <div>
          还原会覆盖当前数据库全部数据；系统会自动先存一份「还原前快照」，失败自动回滚。重装系统前的完整恢复请用 NAS 上的
          <code className="mx-1">scripts/jxc-restore.sh</code>
          配合整包备份。
        </div>
        <details className="pt-1">
          <summary className="cursor-pointer text-blue-700">整机重装后怎么一键恢复（三步，不用懂命令细节）</summary>
          <ol className="mt-1 pl-5 list-decimal space-y-1 text-gray-600">
            <li>在新系统上装好飞牛和 Docker，把整个项目目录 <code>/vol1/1000/jxc</code> 恢复出来（目录里只要有 <code>backup/*.tgz</code> 这一个包）。</li>
            <li>连上 NAS 的 SSH，执行 <code>bash /vol1/1000/jxc/一键恢复.sh</code>（它会自动找最新的包，不用记路径）。</li>
            <li>等它跑完，浏览器打开 <code>http://NAS的IP:3000</code>，用原来的账号密码登录即可，数据、源码、镜像全都在。</li>
          </ol>
        </details>
      </div>

      <Table<BackupFile>
        columns={columns}
        dataSource={list}
        rowKey="name"
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ y: 460 }}
        locale={{ emptyText: '还没有备份，点右上角「立即备份」生成第一份' }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".dump"
        className="hidden"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      <Dialog open={pendingRestore !== null} onOpenChange={(open: boolean) => !open && setPendingRestore(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认还原</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="text-red-600 flex items-center gap-1 font-medium">
              <AlertTriangle className="w-4 h-4" />
              当前数据库的全部数据会被覆盖
            </div>
            <div>
              将用 <b>{pendingRestore?.name}</b>（{formatTime(pendingRestore?.createdAt || '')}）覆盖现有数据。
            </div>
            <div className="text-xs text-gray-500">
              系统会先自动生成一份「还原前快照」，还原过程使用单事务，中途失败会自动回滚，数据保持原样。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingRestore(null)}>
              取消
            </Button>
            <Button size="sm" onClick={handleRestore}>
              确认还原
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={clearOpen} onOpenChange={(open: boolean) => !open && setClearOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>一键清库</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="text-red-600 flex items-center gap-1 font-medium">
              <AlertTriangle className="w-4 h-4" />
              所有业务数据（客户、商品、单据、库存、财务记录）会被清空
            </div>
            <div className="text-xs text-gray-500">
              保留登录账号与系统参数，清完仍能登录使用。清库前会自动生成一份「清库前快照」，
              万一清错了可以在上面的列表里一键还原回来。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClearOpen(false)}>
              取消
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClear}>
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pendingDelete !== null} onOpenChange={(open: boolean) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除备份</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-700">
            删除后无法找回：<b>{pendingDelete?.name}</b>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button size="sm" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
