import { useState, useEffect, useCallback } from 'react';
import { Table, TableColumnsType } from 'antd';
import { Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Label } from '@client/src/components/ui/label';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { systemApi } from '@client/src/api';
import type { SysParam } from '@shared/api.interface';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  PAPER_OPTIONS,
  PRINT_PAPER_PARAM_KEY,
  getPaperPreset,
} from '@/lib/print/paper-presets';

const defaultForm: Partial<SysParam> = {
  paramValue: '',
  remark: '',
};

export default function SysParamPage() {
  const [list, setList] = useState<SysParam[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string>('');
  const [form, setForm] = useState<Partial<SysParam>>(defaultForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await systemApi.paramList();
      setList(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleEdit = (record: SysParam) => {
    setEditingId(record.id);
    setEditingKey(record.paramKey);
    setForm({ paramValue: record.paramValue, remark: record.remark });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingId) return;
    const value = (form.paramValue ?? '').trim();
    if (editingKey === 'order_no_digits') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        toast.error('单据号位数请填 1～10 之间的整数');
        return;
      }
    }
    if (editingKey === 'order_no_start') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        toast.error('起始单据号请填 1 或更大的整数');
        return;
      }
    }
    try {
      await systemApi.paramUpdate(editingId, { ...form, paramValue: value });
      toast.success('修改成功');
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<SysParam> = [
    { title: '参数名称', dataIndex: 'paramName', width: 200, fixed: 'left' },
    { title: '参数键', dataIndex: 'paramKey', width: 200 },
    {
      title: '参数值',
      dataIndex: 'paramValue',
      width: 260,
      render: (v: string, record: SysParam) =>
        record.paramKey === PRINT_PAPER_PARAM_KEY
          ? getPaperPreset(v).label
          : v || '-',
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: SysParam) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(record)}
            className="h-7 px-2"
          >
            <Pencil className="w-3 h-3" />
            编辑
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-gray-800">系统参数设置</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
        </div>
      </div>
      <Table<SysParam>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900, y: 500 }}
        size="small"
        pagination={false}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑系统参数</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>参数值</Label>
              {editingKey === PRINT_PAPER_PARAM_KEY ? (
                <Select
                  value={form.paramValue || 'pin2'}
                  onValueChange={(v: string) => setForm({ ...form, paramValue: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="选择纸型" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : editingKey === 'order_no_digits' || editingKey === 'order_no_start' ? (
                <div className="space-y-1">
                  <Input
                    value={form.paramValue || ''}
                    onChange={(e) => setForm({ ...form, paramValue: e.target.value })}
                    className="h-8"
                    inputMode="numeric"
                  />
                  <div className="text-xs text-gray-500">
                    {editingKey === 'order_no_digits'
                      ? '流水号位数，例如填 5 则单号为 XS20261109' + '00001'
                      : '每月第一张单据的流水号，之后按号往下排，例如填 100 则当月从 ...00100 开始'}
                  </div>
                </div>
              ) : (
                <Input
                  value={form.paramValue || ''}
                  onChange={(e) => setForm({ ...form, paramValue: e.target.value })}
                  className="h-8"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>备注</Label>
              <Textarea
                value={form.remark || ''}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
