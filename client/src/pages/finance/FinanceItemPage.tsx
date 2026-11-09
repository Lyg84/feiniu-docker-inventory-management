import { useState, useEffect, useCallback } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { financeItemApi } from '@client/src/api';
import type { FinanceItem } from '@shared/api.interface';
import { filterByPinyin } from '@/lib/pinyin-match';
import { showConfirm } from '@lark-apaas/client-toolkit';

const defaultForm: Partial<FinanceItem> = {
  name: '',
  type: 'income',
  remark: '',
};

export default function FinanceItemPage() {
  const [list, setList] = useState<FinanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<FinanceItem>>(defaultForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { type?: string } = {};
      if (activeTab === 'income') params.type = 'income';
      else if (activeTab === 'expense') params.type = 'expense';
      const items = await financeItemApi.list(params);
      const filtered = filterByPinyin(items, searchKw, (it: FinanceItem) => [
        it.name,
        it.remark,
      ]);
      setList(filtered);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchKw]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setSearchKw(keyword.trim());
  };

  const handleRefresh = () => {
    fetchData();
  };

  const handleAdd = () => {
    setEditingId(null);
    const type = activeTab === 'all' ? 'income' : activeTab as 'income' | 'expense';
    setForm({ ...defaultForm, type });
    setDialogOpen(true);
  };

  const handleEdit = (record: FinanceItem) => {
    setEditingId(record.id);
    setForm({ ...record });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该收支项目吗？')) return;
    try {
      await financeItemApi.remove(id);
      toast.success('删除成功');
      fetchData();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    if (!form.type) {
      toast.error('请选择项目类型');
      return;
    }
    try {
      if (editingId) {
        await financeItemApi.update(editingId, form);
        toast.success('修改成功');
      } else {
        await financeItemApi.create(form);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<FinanceItem> = [
    { title: '项目名称', dataIndex: 'name', width: 220, fixed: 'left' },
    {
      title: '项目类型',
      dataIndex: 'type',
      width: 120,
      render: (v: 'income' | 'expense') =>
        v === 'income' ? (
          <Badge variant="default" className="bg-emerald-600">收入</Badge>
        ) : (
          <Badge variant="destructive">支出</Badge>
        ),
    },
    { title: '备注', dataIndex: 'remark', width: 300, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: FinanceItem) => (
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
        <div className="text-base font-semibold text-gray-800">收支项目管理</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名称/拼音"
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
      <div className="p-3 border-b border-gray-200">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="income">收入项目</TabsTrigger>
            <TabsTrigger value="expense">支出项目</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab}>
            <Table<FinanceItem>
              columns={columns}
              dataSource={list}
              rowKey="id"
              loading={loading}
              scroll={{ x: 800, y: 500 }}
              size="small"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑收支项目' : '新增收支项目'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                项目名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>
                类型 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.type || 'income'}
                onValueChange={(val: string) =>
                  setForm({ ...form, type: val as 'income' | 'expense' })
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">收入</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                </SelectContent>
              </Select>
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
