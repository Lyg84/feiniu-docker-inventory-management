import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  Undo2,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
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
import { stockOutApi, warehouseApi, productApi } from '@client/src/api';
import type { StockOut, Warehouse, Product } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface StockOutItemForm {
  id?: string;
  productId?: string;
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  sortOrder?: number;
}

const defaultForm: Partial<StockOut> = {
  warehouseId: '',
  outDate: new Date().toISOString().slice(0, 10),
  remark: '',
  items: [],
};

export default function StockOutPage() {
  const [list, setList] = useState<StockOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StockOut>>(defaultForm);
  const [items, setItems] = useState<StockOutItemForm[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(
    async (p = page, kw = searchKw) => {
      setLoading(true);
      try {
        const res = await stockOutApi.list({
          page: p,
          pageSize,
          keyword: kw,
        });
        setList(res.items);
        setTotal(res.total);
        setPage(res.page);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, searchKw],
  );

  useEffect(() => {
    fetchData(1, searchKw);
  }, [searchKw]);

  useEffect(() => {
    warehouseApi.all().then((res) => setWarehouses(res));
    productApi.all().then((res) => setProducts(res));
  }, []);

  const handleSearch = () => {
    setSearchKw(keyword.trim());
    setPage(1);
  };

  const handleRefresh = () => {
    fetchData(page, searchKw);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ ...defaultForm, outDate: new Date().toISOString().slice(0, 10) });
    setItems([]);
    setDialogOpen(true);
  };

  const handleEdit = async (record: StockOut) => {
    setEditingId(record.id);
    setForm({ ...record });
    try {
      const detail = await stockOutApi.get(record.id);
      setItems((detail.items || []).map((it) => ({ ...it })));
    } catch {
      setItems([]);
    }
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该出仓单吗？')) return;
    try {
      await stockOutApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleAudit = async (id: string) => {
    try {
      await stockOutApi.audit(id);
      toast.success('审核成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('审核失败');
    }
  };

  const handleUnaudit = async (id: string) => {
    try {
      await stockOutApi.unaudit(id);
      toast.success('反审核成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('反审核失败');
    }
  };

  const totalQty = useMemo(
    () => items.reduce((sum: number, it: StockOutItemForm) => sum + (it.quantity || 0), 0),
    [items],
  );

  const addItem = () => {
    setItems([
      ...items,
      {
        productName: '',
        spec: '',
        unit: '',
        quantity: 0,
        sortOrder: items.length,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof StockOutItemForm, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as unknown as Record<string, unknown>)[field] = value;
    setItems(newItems);
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        spec: product.spec,
        unit: product.unit,
      };
      setItems(newItems);
    } else {
      updateItem(index, 'productId', '');
    }
  };

  const handleSubmit = async () => {
    if (!form.warehouseId) {
      toast.error('请选择仓库');
      return;
    }
    if (items.length === 0) {
      toast.error('请至少添加一条明细');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productName.trim()) {
        toast.error(`第${i + 1}行商品名称不能为空`);
        return;
      }
      if (!items[i].quantity || items[i].quantity <= 0) {
        toast.error(`第${i + 1}行数量必须大于0`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload: Partial<StockOut> = {
        ...form,
        totalQty,
        items: items.map((it, idx) => ({ ...it, sortOrder: idx })),
      };
      if (editingId) {
        await stockOutApi.update(editingId, payload);
        toast.success('修改成功');
      } else {
        await stockOutApi.create(payload);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<StockOut> = [
    { title: '出仓单号', dataIndex: 'outNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'outDate', width: 110 },
    { title: '仓库', dataIndex: 'warehouseName', width: 140 },
    {
      title: '总数量',
      dataIndex: 'totalQty',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '状态',
      dataIndex: 'auditStatus',
      width: 80,
      render: (v: string) =>
        v === 'audited' ? (
          <Badge variant="default">已审核</Badge>
        ) : (
          <Badge variant="secondary">草稿</Badge>
        ),
    },
    { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_: unknown, record: StockOut) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(record)}
            className="h-7 px-2"
            disabled={record.auditStatus === 'audited'}
          >
            <Pencil className="w-3 h-3" />
            编辑
          </Button>
          {record.auditStatus === 'audited' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUnaudit(record.id)}
              className="h-7 px-2 text-orange-600 hover:text-orange-700"
            >
              <Undo2 className="w-3 h-3" />
              反审核
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAudit(record.id)}
              className="h-7 px-2 text-green-600 hover:text-green-700"
            >
              <CheckCircle2 className="w-3 h-3" />
              审核
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(record.id)}
            className="h-7 px-2 text-red-600 hover:text-red-700"
            disabled={record.auditStatus === 'audited'}
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
        <div className="text-base font-semibold text-gray-800">产品出仓单</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按单号搜索"
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
      <Table<StockOut>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200, y: 500 }}
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑出仓单' : '新增出仓单'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>
                  仓库 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.warehouseId || ''}
                  onValueChange={(v) => setForm({ ...form, warehouseId: v })}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="请选择仓库" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>日期</Label>
                <Input
                  type="date"
                  value={form.outDate || ''}
                  onChange={(e) => setForm({ ...form, outDate: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label>总数量</Label>
                <Input value={totalQty.toFixed(2)} readOnly className="h-8 bg-gray-50" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>备注</Label>
              <Textarea
                value={form.remark || ''}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">明细</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <PlusCircle className="w-3 h-3 mr-1" />
                  添加行
                </Button>
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-10">#</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600">商品名称</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-24">规格</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-20">单位</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-600 w-24">数量</th>
                      <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-12">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-4 text-center text-gray-400">
                          暂无明细，点击"添加行"新增
                        </td>
                      </tr>
                    )}
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-1 text-gray-500">{index + 1}</td>
                        <td className="px-2 py-1">
                          <Select
                            value={item.productId || ''}
                            onValueChange={(v) => handleProductChange(index, v)}
                          >
                            <SelectTrigger className="h-7 w-full">
                              <SelectValue placeholder="选择商品" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={item.spec || ''}
                            onChange={(e) => updateItem(index, 'spec', e.target.value)}
                            className="h-7"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={item.unit || ''}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="h-7"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) =>
                              updateItem(index, 'quantity', Number(e.target.value) || 0)
                            }
                            className="h-7 text-right"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end text-sm">
                <span className="text-gray-500">合计数量：</span>
                <span className="font-semibold text-gray-800 ml-1">{totalQty.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
