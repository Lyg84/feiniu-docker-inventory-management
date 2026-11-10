import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  Undo2,
  X,
  Calendar as CalendarIcon,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import { Calendar } from '@client/src/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { purchaseInApi, supplierApi, productApi } from '@client/src/api';
import type { PurchaseIn, DeliveryItem, Supplier, Product } from '@shared/api.interface';
import PinyinSelect from '@client/src/components/PinyinSelect';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildSupplierOptions, buildProductIdOptions } from '@/lib/entity-options';
import { showConfirm } from '@lark-apaas/client-toolkit';

const defaultItem: DeliveryItem = {
  productName: '',
  spec: '',
  unit: '',
  quantity: 0,
  price: 0,
  amount: 0,
  sortOrder: 0,
};

const blankItems = (count: number = 12): DeliveryItem[] =>
  Array.from({ length: count }, () => ({ ...defaultItem }));

const defaultForm: Partial<PurchaseIn> = {
  supplierId: '',
  supplierName: '',
  inDate: format(new Date(), 'yyyy-MM-dd'),
  remark: '',
  items: [],
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'audited') {
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">已审核</Badge>;
  }
  return <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">草稿</Badge>;
}

function DatePickerField({
  value,
  onChange,
  placeholder = '选择日期',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-8 justify-start font-normal gap-2">
          <CalendarIcon className="w-3 h-3" />
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(d) => d && onChange(format(d, 'yyyy-MM-dd'))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function PurchaseInPage() {
  const [list, setList] = useState<PurchaseIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [form, setForm] = useState<Partial<PurchaseIn>>(defaultForm);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const supplierOptions = useMemo<ComboOption[]>(
    () => buildSupplierOptions(suppliers),
    [suppliers]
  );
  const productOptions = useMemo<ComboOption[]>(
    () => buildProductIdOptions(products),
    [products]
  );

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      const res = await purchaseInApi.list({ page: p, pageSize, keyword: kw });
      setList(res.items);
      setTotal(res.total);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchKw]);

  const fetchSuppliers = useCallback(async () => {
    if (suppliers.length > 0) return;
    setLoadingSuppliers(true);
    try {
      const data = await supplierApi.all();
      setSuppliers(data);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [suppliers.length]);

  const fetchProducts = useCallback(async () => {
    if (products.length > 0) return;
    setLoadingProducts(true);
    try {
      const data = await productApi.all();
      setProducts(data);
    } finally {
      setLoadingProducts(false);
    }
  }, [products.length]);

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
    setViewMode(false);
    setForm({ ...defaultForm, items: blankItems() });
    fetchSuppliers();
    fetchProducts();
    setDialogOpen(true);
  };

  const handleEdit = (record: PurchaseIn) => {
    if (record.auditStatus === 'audited') return;
    setEditingId(record.id);
    setViewMode(false);
    fetchSuppliers();
    fetchProducts();
    purchaseInApi.get(record.id).then((data) => {
      setForm({ ...data, items: data.items && data.items.length > 0 ? data.items : [{ ...defaultItem }] });
      setDialogOpen(true);
    });
  };

  const handleView = (record: PurchaseIn) => {
    fetchSuppliers();
    fetchProducts();
    purchaseInApi.get(record.id).then((data) => {
      setForm({ ...data });
      setViewMode(true);
      setEditingId(record.id);
      setDialogOpen(true);
    });
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该采购入库单吗？')) return;
    try {
      await purchaseInApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleAudit = async (id: string) => {
    if (!await showConfirm('确定审核该采购入库单吗？')) return;
    try {
      await purchaseInApi.audit(id);
      toast.success('审核成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('审核失败');
    }
  };

  const handleUnaudit = async (id: string) => {
    if (!await showConfirm('确定反审核该采购入库单吗？')) return;
    try {
      await purchaseInApi.unaudit(id);
      toast.success('反审核成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('反审核失败');
    }
  };

  const totalAmount = useMemo(() => {
    return (form.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [form.items]);

  const updateItem = (index: number, patch: Partial<DeliveryItem>) => {
    const items = [...(form.items || [])];
    const newItem = { ...items[index], ...patch };
    if ('quantity' in patch || 'price' in patch) {
      const qty = Number(newItem.quantity) || 0;
      const price = Number(newItem.price) || 0;
      newItem.amount = Number((qty * price).toFixed(2));
    }
    items[index] = newItem;
    setForm({ ...form, items });
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(index, {
        productId: product.id,
        productName: product.name,
        spec: product.spec || '',
        unit: product.unit || '',
        price: product.price,
        quantity: 1,
        amount: product.price * 1,
      });
    } else {
      updateItem(index, { productId: '', productName: '', spec: '', unit: '', price: 0, amount: 0 });
    }
  };

  const addItem = () => {
    const items = [...(form.items || []), { ...defaultItem }];
    setForm({ ...form, items });
  };

  const removeItem = (index: number) => {
    const items = [...(form.items || [])];
    items.splice(index, 1);
    if (items.length === 0) items.push({ ...defaultItem });
    setForm({ ...form, items });
  };

  const handleSubmit = async () => {
    if (!form.supplierId) {
      toast.error('请选择供应商');
      return;
    }
    if (!form.inDate) {
      toast.error('请选择日期');
      return;
    }
    const items = form.items || [];
    const validItems = items.filter((item) => item.productName && item.quantity > 0 && item.price > 0);
    if (validItems.length === 0) {
      toast.error('请至少添加一条有效明细');
      return;
    }
    const supplier = suppliers.find((s) => s.id === form.supplierId);
    const payload: Partial<PurchaseIn> = {
      ...form,
      supplierName: supplier?.name || form.supplierName,
      totalAmount: Number(totalAmount.toFixed(2)),
      items: validItems.map((item, i) => ({ ...item, sortOrder: i })),
    };
    try {
      if (editingId) {
        await purchaseInApi.update(editingId, payload);
        toast.success('修改成功');
      } else {
        await purchaseInApi.create(payload);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<PurchaseIn> = [
    { title: '入库单号', dataIndex: 'inNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'inDate', width: 110 },
    { title: '供应商', dataIndex: 'supplierName', width: 180, ellipsis: true },
    { title: '总金额', dataIndex: 'totalAmount', width: 120, align: 'right',
      render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
    { title: '已付款', dataIndex: 'paidAmount', width: 110, align: 'right',
      render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
    { title: '应付款', dataIndex: 'debtAmount', width: 110, align: 'right',
      render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
    { title: '状态', dataIndex: 'auditStatus', width: 100,
      render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_: unknown, record: PurchaseIn) => {
        const isAudited = record.auditStatus === 'audited';
        return (
          <div className="flex gap-1 flex-wrap">
            <Button
              variant="ghost" size="sm"
              onClick={() => handleView(record)}
              className="h-7 px-2"
            >
              查看
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => handleEdit(record)}
              className="h-7 px-2"
              disabled={isAudited}
            >
              <Pencil className="w-3 h-3" />
              编辑
            </Button>
            {!isAudited ? (
              <Button
                variant="ghost" size="sm"
                onClick={() => handleAudit(record.id)}
                className="h-7 px-2 text-green-600 hover:text-green-700"
              >
                <CheckCircle className="w-3 h-3" />
                审核
              </Button>
            ) : (
              <Button
                variant="ghost" size="sm"
                onClick={() => handleUnaudit(record.id)}
                className="h-7 px-2 text-orange-600 hover:text-orange-700"
              >
                <Undo2 className="w-3 h-3" />
                反审核
              </Button>
            )}
            <Button
              variant="ghost" size="sm"
              onClick={() => handleDelete(record.id)}
              className="h-7 px-2 text-red-600 hover:text-red-700"
              disabled={isAudited}
            >
              <Trash2 className="w-3 h-3" />
              删除
            </Button>
          </div>
        );
      },
    },
  ];

  const isDisabled = viewMode;

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-gray-800">采购入库单</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按单号/供应商搜索"
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
      <Table<PurchaseIn>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100, y: 500 }}
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
            <DialogTitle>
              {viewMode ? '查看采购入库单' : editingId ? '编辑采购入库单' : '新增采购入库单'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>供应商 <span className="text-red-500">*</span></Label>
                <PinyinSelect
                  value={form.supplierId || ''}
                  options={supplierOptions}
                  onChange={(v) => {
                    const s = suppliers.find((sup) => sup.id === v);
                    setForm({ ...form, supplierId: v, supplierName: s?.name });
                  }}
                  placeholder="请选择供应商"
                  disabled={isDisabled || loadingSuppliers}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label>日期 <span className="text-red-500">*</span></Label>
                <DatePickerField
                  value={form.inDate || ''}
                  onChange={(v) => setForm({ ...form, inDate: v })}
                />
              </div>
              <div className="space-y-1">
                <Label>备注</Label>
                <Input
                  value={form.remark || ''}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  className="h-8"
                  disabled={isDisabled}
                />
              </div>
            </div>

            <div className="border rounded">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                <span className="text-sm font-medium">商品明细</span>
                {!isDisabled && (
                  <Button variant="ghost" size="sm" onClick={addItem} className="h-7 px-2">
                    <PlusCircle className="w-3 h-3" />
                    添加行
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="text-left px-2 py-2 font-medium w-10">#</th>
                      <th className="text-left px-2 py-2 font-medium">商品名称</th>
                      <th className="text-left px-2 py-2 font-medium w-28">规格</th>
                      <th className="text-left px-2 py-2 font-medium w-20">单位</th>
                      <th className="text-right px-2 py-2 font-medium w-24">数量</th>
                      <th className="text-right px-2 py-2 font-medium w-28">单价</th>
                      <th className="text-right px-2 py-2 font-medium w-28">金额</th>
                      {!isDisabled && <th className="text-center px-2 py-2 font-medium w-12">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(form.items || []).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-1 text-gray-500">{index + 1}</td>
                        <td className="px-2 py-1">
                          {isDisabled ? (
                            item.productName || '-'
                          ) : (
                            <PinyinSelect
                              value={item.productId || ''}
                              options={productOptions}
                              onChange={(v) => handleProductSelect(index, v)}
                              placeholder="选择商品"
                              className="w-full"
                              inputClassName="h-7"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {isDisabled ? (item.spec || '-') : (
                            <Input
                              value={item.spec || ''}
                              onChange={(e) => updateItem(index, { spec: e.target.value })}
                              className="h-7"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {isDisabled ? (item.unit || '-') : (
                            <Input
                              value={item.unit || ''}
                              onChange={(e) => updateItem(index, { unit: e.target.value })}
                              className="h-7"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {isDisabled ? (item.quantity) : (
                            <Input
                              type="number"
                              value={item.quantity || ''}
                              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 0 })}
                              className="h-7 text-right"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {isDisabled ? (item.price?.toFixed(2)) : (
                            <Input
                              type="number"
                              value={item.price || ''}
                              onChange={(e) => updateItem(index, { price: Number(e.target.value) || 0 })}
                              className="h-7 text-right"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">
                          {(Number(item.amount) || 0).toFixed(2)}
                        </td>
                        {!isDisabled && (
                          <td className="px-2 py-1 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            >
                              <MinusCircle className="w-3 h-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td colSpan={6} className="px-3 py-2 text-right font-medium">合计金额：</td>
                      <td className="px-2 py-2 text-right font-semibold text-blue-800">
                        ¥ {totalAmount.toFixed(2)}
                      </td>
                      {!isDisabled && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              {viewMode ? '关闭' : '取消'}
            </Button>
            {!viewMode && (
              <Button size="sm" onClick={handleSubmit}>
                确定
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
