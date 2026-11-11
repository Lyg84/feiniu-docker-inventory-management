import { useState, useEffect, useCallback } from 'react';
import { Table, TableColumnsType } from 'antd';
import { Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { warehouseApi } from '@client/src/api';
import type { Warehouse } from '@shared/api.interface';
import { filterByPinyin } from '@/lib/pinyin-match';
import { showConfirm } from '@/lib/confirm';

const defaultForm: Partial<Warehouse> = {
  name: '',
  address: '',
  manager: '',
  remark: '',
};

export default function WarehousePage() {
  const [list, setList] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Warehouse>>(defaultForm);

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      if (!kw) {
        const res = await warehouseApi.list({ page: p, pageSize, keyword: '' });
        setList(res.items);
        setTotal(res.total);
        setPage(res.page);
        return;
      }
      const all = await warehouseApi.all();
      const rows = filterByPinyin(all, kw, (w: Warehouse) => [
        w.name,
        w.manager,
        w.address,
        w.remark,
      ]);
      setTotal(rows.length);
      setPage(p);
      setList(rows.slice((p - 1) * pageSize, p * pageSize));
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchKw]);

  useEffect(() => {
    fetchData(1, searchKw);
  }, [searchKw]);

  const handleSearch = () => {
    setSearchKw(keyword.trim());
    setPage(1);
  };

  const handleRefresh = () => {
    fetchData(page, searchKw);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const handleEdit = (record: Warehouse) => {
    setEditingId(record.id);
    setForm({ ...record });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该仓库资料吗？')) return;
    try {
      await warehouseApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      toast.error('请输入仓库名称');
      return;
    }
    try {
      if (editingId) {
        await warehouseApi.update(editingId, form);
        toast.success('修改成功');
      } else {
        await warehouseApi.create(form);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<Warehouse> = [
    { title: '仓库名称', dataIndex: 'name', width: 160, fixed: 'left' },
    { title: '地址', dataIndex: 'address', width: 240, ellipsis: true },
    { title: '负责人', dataIndex: 'manager', width: 120 },
    { title: '备注', dataIndex: 'remark', width: 240, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: Warehouse) => (
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(record.id)}
            className="h-7 px-2 text-red-600 hover:text-red-700"
          >
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
        <div className="text-base font-semibold text-gray-800">仓库资料</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名称/拼音/库管员"
              className="w-48 h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" variant="default" onClick={handleSearch}>
              <Search className="w-3 h-3" />
              搜索
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
          <Button size="sm" variant="default" onClick={handleAdd}>
            <Plus className="w-3 h-3" />
            新增
          </Button>
        </div>
      </div>
      <Table<Warehouse>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900, y: 500 }}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            fetchData(p, searchKw);
          },
        }}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑仓库' : '新增仓库'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                仓库名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>负责人</Label>
              <Input
                value={form.manager || ''}
                onChange={(e) =>
                  setForm({ ...form, manager: e.target.value })
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>地址</Label>
              <Input
                value={form.address || ''}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1 col-span-2">
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
