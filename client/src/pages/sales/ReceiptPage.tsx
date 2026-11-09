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
import { buildCustomerOptions } from '@/lib/entity-options';

import { receiptApi, customerApi, salesDeliveryApi } from '@client/src/api';
import type { Receipt, ReceiptItem, Customer, SalesDelivery } from '@shared/api.interface';
import { showConfirm } from '@/lib/confirm';

interface FormItem extends ReceiptItem {
  _key: string;
  totalAmount?: number;
  paidAmount?: number;
  debtAmount?: number;
}

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyItem = (): FormItem => ({
  _key: Math.random().toString(36).slice(2, 10),
  deliveryId: '',
  deliveryNo: '',
  amount: 0,
});

const ReceiptPage: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [list, setList] = useState<Receipt[]>([]);
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
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formMethod, setFormMethod] = useState<string>('cash');
  const [formRemark, setFormRemark] = useState<string>('');
  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDeliveries, setCustomerDeliveries] = useState<SalesDelivery[]>([]);

  const customerOptions = useMemo<ComboOption[]>(
    () => buildCustomerOptions(customers),
    [customers]
  );

  const totalWriteOff = useMemo<number>(
    () => formItems.reduce((sum: number, it: FormItem) => sum + (it.amount || 0), 0),
    [formItems]
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
    receiptApi
      .list(params)
      .then((res) => {
        setList(res.items);
        setTotal(res.total);
      })
      .catch(() => toast.error('加载收款单列表失败'))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchCustomer, searchStatus, searchKeyword, searchStart, searchEnd]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    customerApi
      .all()
      .then((custs: Customer[]) => setCustomers(custs))
      .catch(() => toast.error('加载客户失败'));
  }, []);

  const loadCustomerDeliveries = useCallback((customerId: string): void => {
    if (!customerId) {
      setCustomerDeliveries([]);
      return;
    }
    salesDeliveryApi
      .list({ customerId, auditStatus: 'audited', pageSize: 100, page: 1 })
      .then((res) => setCustomerDeliveries(res.items))
      .catch(() => setCustomerDeliveries([]));
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
    setFormAmount(0);
    setFormMethod('cash');
    setFormRemark('');
    setFormItems([emptyItem()]);
    setCustomerDeliveries([]);
    setDialogOpen(true);
  };

  /** 打开查看/编辑弹窗，明细按 id 调详情接口补全 */
  const openEdit = async (record: Receipt, viewOnly: boolean = false): Promise<void> => {
    let detail: Receipt | null = null;
    try {
      detail = await receiptApi.get(record.id);
    } catch {
      toast.error('读取单据明细失败，先按列表摘要显示');
    }
    const src: Receipt = detail ?? record;
    const customerId = src.customerId || record.customerId;
    setEditId(record.id);
    setViewMode(viewOnly);
    setFormCustomer(customerId);
    setFormDate(src.receiptDate || record.receiptDate);
    setFormAmount(src.totalAmount ?? record.totalAmount);
    setFormMethod(src.paymentMethod || record.paymentMethod || 'cash');
    setFormRemark(src.remark || '');
    setFormItems(
      (src.items || []).map((it: ReceiptItem) => ({
        ...it,
        _key: it.id || Math.random().toString(36).slice(2, 10),
      }))
    );
    loadCustomerDeliveries(customerId);
    setDialogOpen(true);
  };

  const handleCustomerChange = (customerId: string): void => {
    setFormCustomer(customerId);
    loadCustomerDeliveries(customerId);
    // clear deliveries with no matching customer
    setFormItems((prev: FormItem[]) =>
      prev.map((it: FormItem) =>
        it.deliveryId
          ? { ...it, deliveryId: '', deliveryNo: '', amount: 0, totalAmount: undefined, paidAmount: undefined, debtAmount: undefined }
          : it
      )
    );
  };

  const isAudited = (record: Receipt): boolean => record.auditStatus === 'audited';

  const handleAudit = (record: Receipt): void => {
    receiptApi
      .audit(record.id)
      .then(() => {
        toast.success('审核成功');
        loadList();
      })
      .catch(() => toast.error('审核失败'));
  };

  const handleUnaudit = (record: Receipt): void => {
    receiptApi
      .unaudit(record.id)
      .then(() => {
        toast.success('反审核成功');
        loadList();
      })
      .catch(() => toast.error('反审核失败'));
  };

  const handleDelete = async (record: Receipt): Promise<void> => {
    if (!await showConfirm(`确认删除收款单 ${record.receiptNo}？`)) return;
    receiptApi
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

  const handleDeliveryChange = (key: string, deliveryId: string): void => {
    const delivery = customerDeliveries.find((d: SalesDelivery) => d.id === deliveryId);
    setFormItems((prev: FormItem[]) =>
      prev.map((it: FormItem) => {
        if (it._key !== key) return it;
        if (!delivery) {
          return { ...it, deliveryId: '', deliveryNo: '', amount: 0, totalAmount: undefined, paidAmount: undefined, debtAmount: undefined };
        }
        return {
          ...it,
          deliveryId: delivery.id,
          deliveryNo: delivery.orderNo,
          totalAmount: delivery.totalAmount,
          paidAmount: delivery.paidAmount,
          debtAmount: delivery.debtAmount,
          amount: it.amount || 0,
        };
      })
    );
  };

  const updateAmount = (key: string, amount: number): void => {
    setFormItems((prev: FormItem[]) =>
      prev.map((it: FormItem) => (it._key === key ? { ...it, amount } : it))
    );
  };

  const handleSave = (): void => {
    if (!formCustomer) {
      toast.error('请选择客户');
      return;
    }
    if (formAmount <= 0) {
      toast.error('请填写收款金额');
      return;
    }
    if (totalWriteOff > formAmount) {
      toast.error('核销金额不能超过收款金额');
      return;
    }
    const payload = {
      customerId: formCustomer,
      receiptDate: formDate,
      totalAmount: formAmount,
      writeOffAmount: totalWriteOff,
      paymentMethod: formMethod,
      remark: formRemark,
      items: formItems
        .filter((it: FormItem) => it.deliveryId && it.amount > 0)
        .map(({ _key, totalAmount: _ta, paidAmount: _pa, debtAmount: _da, ...rest }) => rest),
    };
    const req = editId
      ? receiptApi.update(editId, payload)
      : receiptApi.create(payload);
    req
      .then(() => {
        toast.success(editId ? '修改成功' : '新增成功');
        setDialogOpen(false);
        loadList();
      })
      .catch(() => toast.error(editId ? '修改失败' : '新增失败'));
  };

  const columns: TableColumnsType<Receipt> = [
    { title: '收款单号', dataIndex: 'receiptNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'receiptDate', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    {
      title: '收款金额',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '核销金额',
      dataIndex: 'writeOffAmount',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    { title: '收款方式', dataIndex: 'paymentMethod', width: 100 },
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
      render: (_: unknown, record: Receipt) => (
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
          <Plus size={14} /> 新增收款单
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
                ? '查看收款单'
                : editId
                ? '编辑收款单'
                : '新增收款单'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <label className="w-20 text-gray-600">客户<span className="text-red-500">*</span></label>
              <PinyinSelect
                value={formCustomer}
                options={customerOptions}
                onChange={handleCustomerChange}
                placeholder="请选择客户"
                disabled={viewMode}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 text-gray-600">日期</label>
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
            <div className="flex items-center gap-2">
              <label className="w-20 text-gray-600">收款金额<span className="text-red-500">*</span></label>
              <Input
                type="number"
                value={String(formAmount)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormAmount(Number(e.target.value))
                }
                className="h-8 text-xs flex-1"
                readOnly={viewMode}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 text-gray-600">收款方式</label>
              <Select
                value={formMethod}
                onValueChange={setFormMethod}
                disabled={viewMode}
              >
                <SelectTrigger size="sm" className="flex-1">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="bank">银行转账</SelectItem>
                  <SelectItem value="wechat">微信</SelectItem>
                  <SelectItem value="alipay">支付宝</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-start gap-2">
              <label className="w-20 text-gray-600 pt-1.5">备注</label>
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
              <span className="text-sm font-medium">核销明细</span>
              {!viewMode && (
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus size={14} /> 新增行
                </Button>
              )}
            </div>

            <div className="border border-gray-200 rounded text-sm">
              <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr_0.6fr] bg-gray-50 font-semibold text-gray-700 text-xs">
                <div className="px-2 py-1.5 border-r border-gray-200">送货单号</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">应收金额</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">已收金额</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">欠款金额</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">本次核销</div>
                <div className="px-2 py-1.5 text-center">操作</div>
              </div>
              {formItems.map((item: FormItem) => (
                <div
                  key={item._key}
                  className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr_0.6fr] border-t border-gray-200 items-center"
                >
                  <div className="px-1 py-1 border-r border-gray-200">
                    <Select
                      value={item.deliveryId || ''}
                      onValueChange={(v: string) => handleDeliveryChange(item._key, v)}
                      disabled={viewMode || !formCustomer}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="选择送货单" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerDeliveries.map((d: SalesDelivery) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.orderNo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="px-2 py-1 border-r border-gray-200 text-right text-xs">
                    {item.totalAmount !== undefined ? item.totalAmount.toFixed(2) : '-'}
                  </div>
                  <div className="px-2 py-1 border-r border-gray-200 text-right text-xs">
                    {item.paidAmount !== undefined ? item.paidAmount.toFixed(2) : '-'}
                  </div>
                  <div className="px-2 py-1 border-r border-gray-200 text-right text-xs text-red-600">
                    {item.debtAmount !== undefined ? item.debtAmount.toFixed(2) : '-'}
                  </div>
                  <div className="px-1 py-1 border-r border-gray-200">
                    <Input
                      type="number"
                      value={String(item.amount)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateAmount(item._key, Number(e.target.value))
                      }
                      className="h-7 text-xs text-right"
                      readOnly={viewMode}
                    />
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
              <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr_0.6fr] border-t border-gray-200 font-semibold bg-gray-50">
                <div className="px-2 py-1.5 col-span-4 text-right text-gray-700">
                  合计核销 / 收款金额：
                </div>
                <div className="px-2 py-1.5 text-right">
                  <span className={totalWriteOff > formAmount ? 'text-red-600' : 'text-blue-700'}>
                    ¥{totalWriteOff.toFixed(2)}
                  </span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-gray-700">¥{formAmount.toFixed(2)}</span>
                </div>
                <div />
              </div>
            </div>
            {totalWriteOff > formAmount && (
              <div className="text-xs text-red-500 mt-1">核销金额不能超过收款金额</div>
            )}
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

export default ReceiptPage;
