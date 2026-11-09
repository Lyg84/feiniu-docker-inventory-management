import { useState, useEffect, useCallback } from 'react';
import { Table, TableColumnsType } from 'antd';
import { Plus, Pencil, Trash2, Search, RefreshCw, Upload } from 'lucide-react';
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
import { productApi } from '@client/src/api';
import ExcelImportDialog, {
  type ImportColumn,
} from '@client/src/components/ExcelImportDialog';

const PRODUCT_IMPORT_COLUMNS: ImportColumn[] = [
  {
    header: '商品名称',
    aliases: ['产品名称', '名称'],
    field: 'name',
    required: true,
    sample: 'A4复印纸',
  },
  {
    header: '规格',
    aliases: ['型号', '规格型号'],
    field: 'spec',
    sample: '70g/500张',
  },
  { header: '单位', field: 'unit', sample: '包' },
  {
    header: '单价',
    aliases: ['价格', '销售价', '售价'],
    field: 'price',
    sample: '22.5',
  },
  {
    header: '库存数量',
    aliases: ['库存'],
    field: 'stockQty',
    sample: '100',
  },
  {
    header: '分类',
    aliases: ['类别'],
    field: 'category',
    sample: '办公耗材',
  },
  { header: '备注', field: 'remark', sample: '' },
];
import type { Product } from '@shared/api.interface';
import { filterByPinyin } from '@/lib/pinyin-match';
import { showConfirm } from '@/lib/confirm';

const defaultForm: Partial<Product> = {
  name: '',
  spec: '',
  unit: '',
  price: 0,
  stockQty: 0,
  category: '',
  remark: '',
};

export default function ProductPage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Product>>(defaultForm);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      if (!kw) {
        const res = await productApi.list({ page: p, pageSize, keyword: '' });
        setList(res.items);
        setTotal(res.total);
        setPage(res.page);
        return;
      }
      const all = await productApi.all();
      const rows = filterByPinyin(all, kw, (it: Product) => [
        it.name,
        it.spec,
        it.unit,
        it.category,
        it.remark,
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

  const handleEdit = (record: Product) => {
    setEditingId(record.id);
    setForm({ ...record });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该产品资料吗？')) return;
    try {
      await productApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      toast.error('请输入产品名称');
      return;
    }
    try {
      if (editingId) {
        await productApi.update(editingId, form);
        toast.success('修改成功');
      } else {
        await productApi.create(form);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<Product> = [
    { title: '产品名称', dataIndex: 'name', width: 160, fixed: 'left' },
    { title: '规格', dataIndex: 'spec', width: 120 },
    { title: '单位', dataIndex: 'unit', width: 80 },
    {
      title: '单价',
      dataIndex: 'price',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '库存数量',
      dataIndex: 'stockQty',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    { title: '类别', dataIndex: 'category', width: 120 },
    { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: Product) => (
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
        <div className="text-base font-semibold text-gray-800">产品资料</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名称/拼音/规格"
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-3 h-3" />
            导入 Excel
          </Button>
          <Button size="sm" variant="default" onClick={handleAdd}>
            <Plus className="w-3 h-3" />
            新增
          </Button>
        </div>
      </div>
      <Table<Product>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000, y: 500 }}
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
            <DialogTitle>{editingId ? '编辑产品' : '新增产品'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                产品名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>规格</Label>
              <Input
                value={form.spec || ''}
                onChange={(e) => setForm({ ...form, spec: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>单位</Label>
              <Input
                value={form.unit || ''}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>单价</Label>
              <Input
                type="number"
                value={form.price ?? ''}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) || 0 })
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>库存数量</Label>
              <Input
                type="number"
                value={form.stockQty ?? ''}
                onChange={(e) =>
                  setForm({ ...form, stockQty: Number(e.target.value) || 0 })
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>类别</Label>
              <Input
                value={form.category || ''}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
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
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入商品资料"
        templateName="商品导入模板.xlsx"
        columns={PRODUCT_IMPORT_COLUMNS}
        onImport={(rows) => productApi.import(rows)}
        onDone={() => fetchData(1, searchKw)}
      />
    </div>
  );
}
