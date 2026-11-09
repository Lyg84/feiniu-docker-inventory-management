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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { paymentApi, supplierApi, purchaseInApi } from '@client/src/api';
import type { Payment, Supplier, PurchaseIn } from '@shared/api.interface';
import PinyinSelect from '@client/src/components/PinyinSelect';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildSupplierOptions } from '@/lib/entity-options';
import { showConfirm } from '@lark-apaas/client-toolkit';

interface PaymentItemForm {
  id?: string;
  inId?: string;
  inNo?: string;
  amount: number;
  debtAmount?: number;
  paidAmount?: number;
  sortOrder?: number;
}

const defaultItem: PaymentItemForm = {
  inId: '',
  inNo: '',
  amount: 0,
  debtAmount: 0,
  paidAmount: 0,
};

const defaultForm: Partial<Payment> = {
  supplierId: '',
  supplierName: '',
  paymentDate: format(new Date(), 'yyyy-MM-dd'),
  totalAmount: 0,
  paymentMethod: '现金',
  remark: '',
  items: [],
};

const PAYMENT_METHODS = ['现金', '银行转账', '支票', '微信', '支付宝', '其他'];

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

export default function PaymentPage() {
  const [list, setList] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [form, setForm] = useState<Partial<Payment>>(defaultForm);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseIns, setPurchaseIns] = useState<PurchaseIn[]>([]);
  const [loadingIns, setLoadingIns] = useState(false);

  const supplierOptions = useMemo<ComboOption[]>(
    () => buildSupplierOptions(suppliers),
    [suppliers]
  );

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      const res = await paymentApi.list({ page: p, pageSize, keyword: kw });
      setList(res.items);
      setTotal(res.total);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchKw]);

  const fetchSuppliers = useCallback(async () => {
    if (suppliers.length > 0) return;
    try {
      const data = await supplierApi.all();
      setSuppliers(data);
    } catch {
      // ignore
    }
  }, [suppliers.length]);

  const fetchPurchaseIns = useCallback(async (supplierId: string) => {
    if (!supplierId) {
      setPurchaseIns([]);
      return;
    }
    setLoadingIns(true);
    try {
      const res = await purchaseInApi.list({ page: 1, pageSize: 100, supplierId });
      setPurchaseIns(res.items);
    } catch {
      setPurchaseIns([]);
    } finally {
      setLoadingIns(false);
    }
  }, []);

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
    setForm({ ...defaultForm, items: [{ ...defaultItem }] });
    fetchSuppliers();
    setDialogOpen(true);
  };

  const handleEdit = (record: Payment) => {
    if (record.auditStatus === 'audited') return;
    setEditingId(record.id);
    setViewMode(false);
    fetchSuppliers();
    paymentApi.get(record.id).then((data) => {
      const items: PaymentItemForm[] = (data.items || []).map((item) => ({
        ...item,
        debtAmount: 0,
        paidAmount: 0,
      }));
      setForm({
        ...data,
        items: items.length > 0 ? items : [{ ...defaultItem }],
      });
      if (data.supplierId) {
        fetchPurchaseIns(data.supplierId);
      }
      setDialogOpen(true);
    });
  };

  const handleView = (record: Payment) => {
    fetchSuppliers();
    paymentApi.get(record.id).then((data) => {
      setForm({ ...data });
      setViewMode(true);
      setEditingId(record.id);
      if (data.supplierId) {
        fetchPurchaseIns(data.supplierId);
      }
      setDialogOpen(true);
    });
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该采购付款单吗？')) return;
    try {
      await paymentApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleAudit = async (id: string) => {
    if (!await showConfirm('确定审核该采购付款单吗？')) return;
    try {
      await paymentApi.audit(id);
      toast.success('审核成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('审核失败');
    }
  };

  const handleUnaudit = async (id: string) => {
    if (!await showConfirm('确定反审核该采购付款单吗？')) return;
    try {
      await paymentApi.unaudit(id);
      toast.success('反审核成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('反审核失败');
    }
  };

  const writeOffTotal = useMemo(() => {
    return (form.items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [form.items]);

  const updateItem = (index: number, patch: Partial<PaymentItemForm>) => {
    const items = [...((form.items as PaymentItemForm[]) || [])];
    items[index] = { ...items[index], ...patch };
    setForm({ ...form, items });
  };

  const handleInSelect = (index: number, inId: string) => {
    const inRecord = purchaseIns.find((p) => p.id === inId);
    if (inRecord) {
      updateItem(index, {
        inId: inRecord.id,
        inNo: inRecord.inNo,
        debtAmount: inRecord.debtAmount,
        paidAmount: inRecord.paidAmount,
        amount: 0,
      });
    } else {
      updateItem(index, { inId: '', inNo: '', debtAmount: 0, paidAmount: 0, amount: 0 });
    }
  };

  const addItem = () => {
    const items = [...((form.items as PaymentItemForm[]) || []), { ...defaultItem }];
    setForm({ ...form, items });
  };

  const removeItem = (index: number) => {
    const items = [...((form.items as PaymentItemForm[]) || [])];
    items.splice(index, 1);
    if (items.length === 0) items.push({ ...defaultItem });
    setForm({ ...form, items });
  };

  const handleSupplierChange = (supplierId: string) => {
    const s = suppliers.find((sup) => sup.id === supplierId);
    setForm({
      ...form,
      supplierId,
      supplierName: s?.name,
      items: [{ ...defaultItem }],
    });
    fetchPurchaseIns(supplierId);
  };

  const handleSubmit = async () => {
    if (!form.supplierId) {
      toast.error('请选择供应商');
      return;
    }
    if (!form.paymentDate) {
      toast.error('请选择日期');
      return;
    }
    const items = form.items || [];
    const validItems = items.filter((item) => item.inId && item.amount > 0);
    const total = Number(form.totalAmount) || 0;
    const writeOff = validItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (total <= 0) {
      toast.error('付款金额必须大于0');
      return;
    }
    if (writeOff > total) {
      toast.error('核销金额不能大于付款金额');
      return;
    }
    const supplier = suppliers.find((s) => s.id === form.supplierId);
    const payload: Partial<Payment> = {
      ...form,
      supplierName: supplier?.name || form.supplierName,
      writeOffAmount: Number(writeOff.toFixed(2)),
      items: validItems.map((item, i) => ({
        id: item.id,
        inId: item.inId,
        inNo: item.inNo,
        amount: Number(item.amount.toFixed(2)),
        sortOrder: i,
      })),
    };
    try {
      if (editingId) {
        await paymentApi.update(editingId, payload);
        toast.success('修改成功');
      } else {
        await paymentApi.create(payload);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<Payment> = [
    { title: '付款单号', dataIndex: 'paymentNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'paymentDate', width: 110 },
    { title: '供应商', dataIndex: 'supplierName', width: 180, ellipsis: true },
    { title: '付款金额', dataIndex: 'totalAmount', width: 120, align: 'right',
      render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
    { title: '核销金额', dataIndex: 'writeOffAmount', width: 120, align: 'right',
      render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
    { title: '付款方式', dataIndex: 'paymentMethod', width: 100 },
    { title: '状态', dataIndex: 'auditStatus', width: 100,
      render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_: unknown, record: Payment) => {
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
        <div className="text-base font-semibold text-gray-800">采购付款单</div>
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
      <Table<Payment>
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
              {viewMode ? '查看采购付款单' : editingId ? '编辑采购付款单' : '新增采购付款单'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>供应商 <span className="text-red-500">*</span></Label>
                <PinyinSelect
                  value={form.supplierId || ''}
                  options={supplierOptions}
                  onChange={handleSupplierChange}
                  placeholder="请选择供应商"
                  disabled={isDisabled}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label>日期 <span className="text-red-500">*</span></Label>
                <DatePickerField
                  value={form.paymentDate || ''}
                  onChange={(v) => setForm({ ...form, paymentDate: v })}
                />
              </div>
              <div className="space-y-1">
                <Label>付款金额 <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={form.totalAmount || ''}
                  onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) || 0 })}
                  className="h-8"
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-1">
                <Label>付款方式</Label>
                <Select
                  value={form.paymentMethod || '现金'}
                  onValueChange={(v) => setForm({ ...form, paymentMethod: v })}
                  disabled={isDisabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="选择付款方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
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
                <span className="text-sm font-medium">核销明细（选择采购入库单进行核销）</span>
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
                      <th className="text-left px-2 py-2 font-medium">采购入库单</th>
                      <th className="text-right px-2 py-2 font-medium w-28">应付款</th>
                      <th className="text-right px-2 py-2 font-medium w-28">已付款</th>
                      <th className="text-right px-2 py-2 font-medium w-32">本次核销</th>
                      {!isDisabled && <th className="text-center px-2 py-2 font-medium w-12">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {((form.items as PaymentItemForm[]) || []).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-1 text-gray-500">{index + 1}</td>
                        <td className="px-2 py-1">
                          {isDisabled ? (
                            item.inNo || '-'
                          ) : (
                            <Select
                              value={item.inId || ''}
                              onValueChange={(v) => handleInSelect(index, v)}
                              disabled={!form.supplierId || loadingIns}
                            >
                              <SelectTrigger className="h-7">
                                <SelectValue placeholder="选择入库单" />
                              </SelectTrigger>
                              <SelectContent>
                                {purchaseIns.filter(p => p.debtAmount > 0).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.inNo} - 应付 ¥{p.debtAmount?.toFixed(2)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right">
                          ¥ {(Number(item.debtAmount) || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          ¥ {(Number(item.paidAmount) || 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1">
                          {isDisabled ? (
                            <div className="text-right font-medium">¥ {(Number(item.amount) || 0).toFixed(2)}</div>
                          ) : (
                            <Input
                              type="number"
                              value={item.amount || ''}
                              onChange={(e) => updateItem(index, { amount: Number(e.target.value) || 0 })}
                              className="h-7 text-right"
                              disabled={!item.inId}
                            />
                          )}
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
                      <td colSpan={4} className="px-3 py-2 text-right font-medium">核销合计：</td>
                      <td className="px-2 py-2 text-right font-semibold text-blue-800">
                        ¥ {writeOffTotal.toFixed(2)}
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
