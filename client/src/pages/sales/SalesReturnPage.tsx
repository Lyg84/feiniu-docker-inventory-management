import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, type TableColumnsType } from 'antd';
import { Plus, Search, Eye, Pencil, Trash2, CheckCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
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
import { Textarea } from '@client/src/components/ui/textarea';
import PinyinSelect from '@client/src/components/PinyinSelect';
import QuickRangeSelect from '@client/src/components/QuickRangeSelect';
import { quickRange } from '@/lib/quick-range';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildCustomerOptions, buildProductIdOptions } from '@/lib/entity-options';

import { salesReturnApi, customerApi, productApi } from '@client/src/api';
import type { SalesReturn, DeliveryItem, Customer, Product } from '@shared/api.interface';
import { showConfirm } from '@/lib/confirm';

interface FormItem extends DeliveryItem {
  _key: string;
}

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyItem = (): FormItem => ({
  _key: Math.random().toString(36).slice(2, 10),
  productName: '',
  spec: '',
  unit: '',
  quantity: 0,
  price: 0,
  amount: 0,
});

const SalesReturnPage: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [list, setList] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [searchCustomer, setSearchCustomer] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchRange, setSearchRange] = useState<string>('month');
  const [searchStart, setSearchStart] = useState<string>(quickRange('month')[0]);
  const [searchEnd, setSearchEnd] = useState<string>(quickRange('month')[1]);

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<boolean>(false);
  const [formCustomer, setFormCustomer] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(todayStr());
  const [formRemark, setFormRemark] = useState<string>('');
  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const totalAmount = useMemo<number>(
    () => formItems.reduce((sum: number, it: FormItem) => sum + (it.amount || 0), 0),
    [formItems]
  );

  const customerOptions = useMemo<ComboOption[]>(
    () => buildCustomerOptions(customers),
    [customers]
  );

  const productOptions = useMemo<ComboOption[]>(
    () => buildProductIdOptions(products),
    [products]
  );

  const loadList = useCallback((): void => {
    setLoading(true);
    const params: Record<string, unknown> = {
      page: String(page),
      pageSize: String(pageSize),
    };
    if (searchCustomer) params.customerId = searchCustomer;
    if (searchStatus && searchStatus !== 'all') params.auditStatus = searchStatus;
    if (searchKeyword) params.keyword = searchKeyword;
    if (searchStart) params.startDate = searchStart;
    if (searchEnd) params.endDate = searchEnd;
    salesReturnApi
      .list(params)
      .then((res) => {
        setList(res.items);
        setTotal(res.total);
      })
      .catch(() => toast.error('加载退货单列表失败'))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchCustomer, searchStatus, searchKeyword, searchStart, searchEnd]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    Promise.all([customerApi.all(), productApi.all()])
      .then(([custs, prods]) => {
        setCustomers(custs);
        setProducts(prods);
      })
      .catch(() => toast.error('加载基础资料失败'));
  }, []);

  const handleSearch = (): void => {
    setPage(1);
    setTimeout(loadList, 0);
  };

  const handleReset = (): void => {
    setSearchCustomer('');
    setSearchStatus('all');
    setSearchKeyword('');
    setSearchRange('month');
    setSearchStart(quickRange('month')[0]);
    setSearchEnd(quickRange('month')[1]);
    setPage(1);
    setTimeout(loadList, 0);
  };

  /** 选快捷时间后自动回填起止日期 */
  const handleRangeChange = (key: string): void => {
    if (!key) return;
    const [start, end] = quickRange(key);
    setSearchRange(key);
    setSearchStart(start);
    setSearchEnd(end);
  };

  const openCreate = (): void => {
    setEditId(null);
    setViewMode(false);
    setFormCustomer('');
    setFormDate(todayStr());
    setFormRemark('');
    setFormItems([emptyItem()]);
    setDialogOpen(true);
  };

  /** 打开查看/编辑弹窗，明细按 id 调详情接口补全 */
  const openEdit = async (record: SalesReturn, viewOnly: boolean = false): Promise<void> => {
    let detail: SalesReturn | null = null;
    try {
      detail = await salesReturnApi.get(record.id);
    } catch {
      toast.error('读取单据明细失败，先按列表摘要显示');
    }
    const src: SalesReturn = detail ?? record;
    setEditId(record.id);
    setViewMode(viewOnly);
    setFormCustomer(src.customerId || record.customerId);
    setFormDate(src.returnDate || record.returnDate);
    setFormRemark(src.remark || '');
    setFormItems(
      (src.items || []).map((it: DeliveryItem) => ({
        ...it,
        _key: it.id || Math.random().toString(36).slice(2, 10),
      }))
    );
    setDialogOpen(true);
  };

  const isAudited = (record: SalesReturn): boolean => record.auditStatus === 'audited';

  const handleAudit = (record: SalesReturn): void => {
    salesReturnApi
      .audit(record.id)
      .then(() => {
        toast.success('审核成功');
        loadList();
      })
      .catch(() => toast.error('审核失败'));
  };

  const handleUnaudit = (record: SalesReturn): void => {
    salesReturnApi
      .unaudit(record.id)
      .then(() => {
        toast.success('反审核成功');
        loadList();
      })
      .catch(() => toast.error('反审核失败'));
  };

  const handleDelete = async (record: SalesReturn): Promise<void> => {
    if (!await showConfirm(`确认删除退货单 ${record.returnNo}？`)) return;
    salesReturnApi
      .remove(record.id)
      .then(() => {
        toast.success('删除成功');
        loadList();
      })
      .catch(() => toast.error('删除失败'));
  };

  const addLine = (): void => {
    setFormItems((prev: FormItem[]) => [...prev, emptyItem()]);
  };

  const removeLine = (key: string): void => {
    setFormItems((prev: FormItem[]) =>
      prev.length === 1 ? [emptyItem()] : prev.filter((it: FormItem) => it._key !== key)
    );
  };

  const updateItem = (key: string, patch: Partial<FormItem>): void => {
    setFormItems((prev: FormItem[]) =>
      prev.map((it: FormItem) => {
        if (it._key !== key) return it;
        const next: FormItem = { ...it, ...patch };
        if (patch.quantity !== undefined || patch.price !== undefined) {
          next.amount = Number(((next.quantity || 0) * (next.price || 0)).toFixed(2));
        }
        return next;
      })
    );
  };

  const handleProductSelect = (key: string, productId: string): void => {
    const prod = products.find((p: Product) => p.id === productId);
    updateItem(key, {
      productId,
      productName: prod?.name || '',
      spec: prod?.spec || '',
      unit: prod?.unit || '',
      price: prod?.price || 0,
    });
  };

  const handleSave = (): void => {
    if (!formCustomer) {
      toast.error('请选择客户');
      return;
    }
    if (formItems.some((it: FormItem) => !it.productName)) {
      toast.error('请选择商品名称');
      return;
    }
    if (formItems.some((it: FormItem) => it.quantity <= 0 || it.price < 0)) {
      toast.error('请填写正确的数量和单价');
      return;
    }
    const payload = {
      customerId: formCustomer,
      returnDate: formDate,
      remark: formRemark,
      totalAmount,
      items: formItems.map(({ _key, ...rest }) => rest),
    };
    const req = editId
      ? salesReturnApi.update(editId, payload)
      : salesReturnApi.create(payload);
    req
      .then(() => {
        toast.success(editId ? '修改成功' : '新增成功');
        setDialogOpen(false);
        loadList();
      })
      .catch(() => toast.error(editId ? '修改失败' : '新增失败'));
  };

  const columns: TableColumnsType<SalesReturn> = [
    { title: '退货单号', dataIndex: 'returnNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'returnDate', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    { title: '原送货单号', dataIndex: 'deliveryNo', width: 160 },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '状态',
      dataIndex: 'auditStatus',
      width: 90,
      render: (v: string) =>
        v === 'audited' ? (
          <Badge variant="default">已审核</Badge>
        ) : (
          <Badge variant="secondary">草稿</Badge>
        ),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 260,
      render: (_: unknown, record: SalesReturn) => (
        <div className="flex gap-1 items-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void openEdit(record, true)}
          >
            <Eye size={14} /> 查看
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void openEdit(record, false)}
            disabled={isAudited(record)}
          >
            <Pencil size={14} /> 编辑
          </Button>
          {isAudited(record) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleUnaudit(record)}
            >
              <RotateCcw size={14} /> 反审核
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAudit(record)}
            >
              <CheckCircle size={14} /> 审核
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(record)}
            disabled={isAudited(record)}
          >
            <Trash2 size={14} /> 删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> 新增退货单
        </Button>

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <PinyinSelect
          value={searchCustomer}
          options={customerOptions}
          onChange={setSearchCustomer}
          placeholder="全部客户"
          className="w-40"
        />

        <Select value={searchStatus} onValueChange={setSearchStatus}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="audited">已审核</SelectItem>
          </SelectContent>
        </Select>

        <QuickRangeSelect value={searchRange} onChange={handleRangeChange} />

        <Input
          value={searchStart}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchStart(e.target.value);
            setSearchRange('');
          }}
          type="date"
          className="w-40 h-8 text-xs"
          placeholder="开始日期"
        />
        <span className="text-gray-400">至</span>
        <Input
          value={searchEnd}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchEnd(e.target.value);
            setSearchRange('');
          }}
          type="date"
          className="w-40 h-8 text-xs"
          placeholder="结束日期"
        />

        <Input
          value={searchKeyword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchKeyword(e.target.value)
          }
          placeholder="单号/关键字"
          className="w-44 h-8 text-xs"
        />

        <Button size="sm" variant="default" onClick={handleSearch}>
          <Search size={14} /> 搜索
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset}>
          重置
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 1100, y: 500 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (p: number) => setPage(p),
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>
              {viewMode
                ? '查看退货单'
                : editId
                ? '编辑退货单'
                : '新增退货单'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <label className="w-16 text-gray-600">客户<span className="text-red-500">*</span></label>
              <PinyinSelect
                value={formCustomer}
                options={customerOptions}
                onChange={setFormCustomer}
                placeholder="请选择客户"
                disabled={viewMode}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-gray-600">日期</label>
              <Input
                value={formDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormDate(e.target.value)
                }
                type="date"
                className="h-8 text-xs flex-1"
                readOnly={viewMode}
              />
            </div>
            <div className="col-span-2 flex items-start gap-2">
              <label className="w-16 text-gray-600 pt-1.5">备注</label>
              <Textarea
                value={formRemark}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormRemark(e.target.value)
                }
                rows={2}
                className="flex-1 text-xs"
                readOnly={viewMode}
                placeholder="备注信息"
              />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">退货明细</span>
              {!viewMode && (
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus size={14} /> 新增行
                </Button>
              )}
            </div>

            <div className="border border-gray-200 rounded text-sm">
              <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.6fr] bg-gray-50 font-semibold text-gray-700 text-xs">
                <div className="px-2 py-1.5 border-r border-gray-200">商品名称*</div>
                <div className="px-2 py-1.5 border-r border-gray-200">规格</div>
                <div className="px-2 py-1.5 border-r border-gray-200">单位</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">数量*</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">单价*</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">金额</div>
                <div className="px-2 py-1.5 text-center">操作</div>
              </div>
              {formItems.map((item: FormItem) => (
                <div
                  key={item._key}
                  className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.6fr] border-t border-gray-200 items-center"
                >
                  <div className="px-1 py-1 border-r border-gray-200">
                    <PinyinSelect
                      value={
                        item.productId ||
                        products.find((p: Product) => p.name === item.productName)?.id ||
                        ''
                      }
                      options={productOptions}
                      onChange={(v: string) => handleProductSelect(item._key, v)}
                      placeholder="选择商品"
                      disabled={viewMode}
                      className="w-full"
                      inputClassName="h-7"
                    />
                  </div>
                  <div className="px-2 py-1 border-r border-gray-200 text-xs text-gray-700">
                    {item.spec || '-'}
                  </div>
                  <div className="px-2 py-1 border-r border-gray-200 text-xs text-gray-700">
                    {item.unit || '-'}
                  </div>
                  <div className="px-1 py-1 border-r border-gray-200">
                    <Input
                      type="number"
                      value={String(item.quantity)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item._key, { quantity: Number(e.target.value) })
                      }
                      className="h-7 text-xs text-right"
                      readOnly={viewMode}
                    />
                  </div>
                  <div className="px-1 py-1 border-r border-gray-200">
                    <Input
                      type="number"
                      value={String(item.price)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item._key, { price: Number(e.target.value) })
                      }
                      className="h-7 text-xs text-right"
                      readOnly={viewMode}
                    />
                  </div>
                  <div className="px-2 py-1 border-r border-gray-200 text-right text-xs font-medium">
                    {item.amount.toFixed(2)}
                  </div>
                  <div className="px-1 py-1 text-center">
                    {!viewMode && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLine(item._key)}
                      >
                        <Trash2 size={12} /> 删除
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.6fr] border-t border-gray-200 font-semibold bg-gray-50">
                <div className="px-2 py-1.5 col-span-5 text-right text-gray-700">
                  合计金额：
                </div>
                <div className="px-2 py-1.5 text-right text-red-600">
                  ¥{totalAmount.toFixed(2)}
                </div>
                <div />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              {viewMode ? '关闭' : '取消'}
            </Button>
            {!viewMode && (
              <Button size="sm" onClick={handleSave}>
                保存
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesReturnPage;
