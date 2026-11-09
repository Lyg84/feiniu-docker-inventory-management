import React, { useState, useEffect, useCallback } from 'react';
import { Table, type TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Search, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
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

import {
  salesDeliveryApi,
  salesReturnApi,
  receiptApi,
  customerApi,
} from '@client/src/api';
import type {
  SalesDelivery,
  SalesReturn,
  Receipt,
  Customer,
  DeliveryItem,
  ReceiptItem,
} from '@shared/api.interface';

type TabKey = 'delivery' | 'return' | 'receipt';

const SalesSearchPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('delivery');
  const [customers, setCustomers] = useState<Customer[]>([]);

  // search params
  const [searchCustomer, setSearchCustomer] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchStart, setSearchStart] = useState<string>('');
  const [searchEnd, setSearchEnd] = useState<string>('');

  // delivery list
  const [deliveryPage, setDeliveryPage] = useState<number>(1);
  const [deliveryList, setDeliveryList] = useState<SalesDelivery[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState<number>(0);

  // return list
  const [returnPage, setReturnPage] = useState<number>(1);
  const [returnList, setReturnList] = useState<SalesReturn[]>([]);
  const [returnTotal, setReturnTotal] = useState<number>(0);

  // receipt list
  const [receiptPage, setReceiptPage] = useState<number>(1);
  const [receiptList, setReceiptList] = useState<Receipt[]>([]);
  const [receiptTotal, setReceiptTotal] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [pageSize] = useState<number>(20);

  // detail dialog
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailType, setDetailType] = useState<TabKey>('delivery');
  const [detailData, setDetailData] = useState<SalesDelivery | SalesReturn | Receipt | null>(null);

  useEffect(() => {
    customerApi
      .all()
      .then((custs: Customer[]) => setCustomers(custs))
      .catch(() => toast.error('加载客户列表失败'));
  }, []);

  const loadDeliveries = useCallback((): void => {
    setLoading(true);
    const params: Record<string, unknown> = {
      page: String(deliveryPage),
      pageSize: String(pageSize),
    };
    if (searchCustomer) params.customerId = searchCustomer;
    if (searchStatus) params.auditStatus = searchStatus;
    if (searchKeyword) params.keyword = searchKeyword;
    if (searchStart) params.startDate = searchStart;
    if (searchEnd) params.endDate = searchEnd;
    salesDeliveryApi
      .list(params)
      .then((res) => {
        setDeliveryList(res.items);
        setDeliveryTotal(res.total);
      })
      .catch(() => toast.error('加载送货单列表失败'))
      .finally(() => setLoading(false));
  }, [deliveryPage, pageSize, searchCustomer, searchStatus, searchKeyword, searchStart, searchEnd]);

  const loadReturns = useCallback((): void => {
    setLoading(true);
    const params: Record<string, unknown> = {
      page: String(returnPage),
      pageSize: String(pageSize),
    };
    if (searchCustomer) params.customerId = searchCustomer;
    if (searchStatus) params.auditStatus = searchStatus;
    if (searchKeyword) params.keyword = searchKeyword;
    if (searchStart) params.startDate = searchStart;
    if (searchEnd) params.endDate = searchEnd;
    salesReturnApi
      .list(params)
      .then((res) => {
        setReturnList(res.items);
        setReturnTotal(res.total);
      })
      .catch(() => toast.error('加载退货单列表失败'))
      .finally(() => setLoading(false));
  }, [returnPage, pageSize, searchCustomer, searchStatus, searchKeyword, searchStart, searchEnd]);

  const loadReceipts = useCallback((): void => {
    setLoading(true);
    const params: Record<string, unknown> = {
      page: String(receiptPage),
      pageSize: String(pageSize),
    };
    if (searchCustomer) params.customerId = searchCustomer;
    if (searchStatus) params.auditStatus = searchStatus;
    if (searchKeyword) params.keyword = searchKeyword;
    if (searchStart) params.startDate = searchStart;
    if (searchEnd) params.endDate = searchEnd;
    receiptApi
      .list(params)
      .then((res) => {
        setReceiptList(res.items);
        setReceiptTotal(res.total);
      })
      .catch(() => toast.error('加载收款单列表失败'))
      .finally(() => setLoading(false));
  }, [receiptPage, pageSize, searchCustomer, searchStatus, searchKeyword, searchStart, searchEnd]);

  useEffect(() => {
    if (activeTab === 'delivery') loadDeliveries();
  }, [activeTab, loadDeliveries]);

  useEffect(() => {
    if (activeTab === 'return') loadReturns();
  }, [activeTab, loadReturns]);

  useEffect(() => {
    if (activeTab === 'receipt') loadReceipts();
  }, [activeTab, loadReceipts]);

  const handleSearch = (): void => {
    if (activeTab === 'delivery') {
      setDeliveryPage(1);
      setTimeout(loadDeliveries, 0);
    } else if (activeTab === 'return') {
      setReturnPage(1);
      setTimeout(loadReturns, 0);
    } else {
      setReceiptPage(1);
      setTimeout(loadReceipts, 0);
    }
  };

  const handleReset = (): void => {
    setSearchCustomer('');
    setSearchStatus('');
    setSearchKeyword('');
    setSearchStart('');
    setSearchEnd('');
    handleSearch();
  };

  const viewDelivery = (record: SalesDelivery): void => {
    setDetailType('delivery');
    setDetailData(record);
    setDetailOpen(true);
  };

  const viewReturn = (record: SalesReturn): void => {
    setDetailType('return');
    setDetailData(record);
    setDetailOpen(true);
  };

  const viewReceipt = (record: Receipt): void => {
    setDetailType('receipt');
    setDetailData(record);
    setDetailOpen(true);
  };

  const deliveryColumns: TableColumnsType<SalesDelivery> = [
    { title: '送货单号', dataIndex: 'orderNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'orderDate', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '已收款',
      dataIndex: 'paidAmount',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '欠款',
      dataIndex: 'debtAmount',
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
      width: 80,
      render: (_: unknown, record: SalesDelivery) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => viewDelivery(record)}
        >
          <Eye size={14} /> 查看
        </Button>
      ),
    },
  ];

  const returnColumns: TableColumnsType<SalesReturn> = [
    { title: '退货单号', dataIndex: 'returnNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'returnDate', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
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
      width: 80,
      render: (_: unknown, record: SalesReturn) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => viewReturn(record)}
        >
          <Eye size={14} /> 查看
        </Button>
      ),
    },
  ];

  const receiptColumns: TableColumnsType<Receipt> = [
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
      width: 80,
      render: (_: unknown, record: Receipt) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => viewReceipt(record)}
        >
          <Eye size={14} /> 查看
        </Button>
      ),
    },
  ];

  const renderDetailItems = (): React.ReactNode => {
    if (!detailData) return null;

    if (detailType === 'delivery') {
      const d = detailData as SalesDelivery;
      const items: DeliveryItem[] = d.items || [];
      return (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">送货单号：</span>
              <span className="font-medium">{d.orderNo}</span>
            </div>
            <div>
              <span className="text-gray-500">日期：</span>
              <span>{d.orderDate}</span>
            </div>
            <div>
              <span className="text-gray-500">客户：</span>
              <span>{d.customerName}</span>
            </div>
            <div>
              <span className="text-gray-500">状态：</span>
              {d.auditStatus === 'audited' ? (
                <Badge variant="default">已审核</Badge>
              ) : (
                <Badge variant="secondary">草稿</Badge>
              )}
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">备注：</span>
              <span>{d.remark || '-'}</span>
            </div>
          </div>

          <div className="mt-3 border border-gray-200 rounded text-sm">
            <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] bg-gray-50 font-semibold text-gray-700 text-xs">
              <div className="px-2 py-1.5 border-r border-gray-200">商品名称</div>
              <div className="px-2 py-1.5 border-r border-gray-200">规格</div>
              <div className="px-2 py-1.5 border-r border-gray-200">单位</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">数量</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">单价</div>
              <div className="px-2 py-1.5 text-right">金额</div>
            </div>
            {items.map((it: DeliveryItem, i: number) => (
              <div
                key={it.id || i}
                className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] border-t border-gray-200"
              >
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.productName}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.spec || '-'}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.unit || '-'}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs text-right">
                  {it.quantity}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs text-right">
                  {it.price.toFixed(2)}
                </div>
                <div className="px-2 py-1.5 text-xs text-right font-medium">
                  {it.amount.toFixed(2)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] border-t border-gray-200 bg-gray-50 font-semibold">
              <div className="px-2 py-1.5 col-span-5 text-right text-gray-700">合计：</div>
              <div className="px-2 py-1.5 text-right text-red-600">
                ¥{d.totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </>
      );
    }

    if (detailType === 'return') {
      const r = detailData as SalesReturn;
      const items: DeliveryItem[] = r.items || [];
      return (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">退货单号：</span>
              <span className="font-medium">{r.returnNo}</span>
            </div>
            <div>
              <span className="text-gray-500">日期：</span>
              <span>{r.returnDate}</span>
            </div>
            <div>
              <span className="text-gray-500">客户：</span>
              <span>{r.customerName}</span>
            </div>
            <div>
              <span className="text-gray-500">状态：</span>
              {r.auditStatus === 'audited' ? (
                <Badge variant="default">已审核</Badge>
              ) : (
                <Badge variant="secondary">草稿</Badge>
              )}
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">备注：</span>
              <span>{r.remark || '-'}</span>
            </div>
          </div>

          <div className="mt-3 border border-gray-200 rounded text-sm">
            <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] bg-gray-50 font-semibold text-gray-700 text-xs">
              <div className="px-2 py-1.5 border-r border-gray-200">商品名称</div>
              <div className="px-2 py-1.5 border-r border-gray-200">规格</div>
              <div className="px-2 py-1.5 border-r border-gray-200">单位</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">数量</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">单价</div>
              <div className="px-2 py-1.5 text-right">金额</div>
            </div>
            {items.map((it: DeliveryItem, i: number) => (
              <div
                key={it.id || i}
                className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] border-t border-gray-200"
              >
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.productName}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.spec || '-'}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.unit || '-'}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs text-right">
                  {it.quantity}
                </div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs text-right">
                  {it.price.toFixed(2)}
                </div>
                <div className="px-2 py-1.5 text-xs text-right font-medium">
                  {it.amount.toFixed(2)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] border-t border-gray-200 bg-gray-50 font-semibold">
              <div className="px-2 py-1.5 col-span-5 text-right text-gray-700">合计：</div>
              <div className="px-2 py-1.5 text-right text-red-600">
                ¥{r.totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </>
      );
    }

    // receipt
    const rc = detailData as Receipt;
    const items: ReceiptItem[] = rc.items || [];
    return (
      <>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">收款单号：</span>
            <span className="font-medium">{rc.receiptNo}</span>
          </div>
          <div>
            <span className="text-gray-500">日期：</span>
            <span>{rc.receiptDate}</span>
          </div>
          <div>
            <span className="text-gray-500">客户：</span>
            <span>{rc.customerName}</span>
          </div>
          <div>
            <span className="text-gray-500">收款方式：</span>
            <span>{rc.paymentMethod || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">收款金额：</span>
            <span className="font-semibold text-blue-700">¥{rc.totalAmount.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">核销金额：</span>
            <span className="font-semibold text-green-700">¥{rc.writeOffAmount.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">状态：</span>
            {rc.auditStatus === 'audited' ? (
              <Badge variant="default">已审核</Badge>
            ) : (
              <Badge variant="secondary">草稿</Badge>
            )}
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">备注：</span>
            <span>{rc.remark || '-'}</span>
          </div>
        </div>

        <div className="mt-3 border border-gray-200 rounded text-sm">
          <div className="grid grid-cols-[2fr_1fr] bg-gray-50 font-semibold text-gray-700 text-xs">
            <div className="px-2 py-1.5 border-r border-gray-200">送货单号</div>
            <div className="px-2 py-1.5 text-right">核销金额</div>
          </div>
          {items.length === 0 ? (
            <div className="px-2 py-4 text-center text-gray-400 text-xs">无核销明细</div>
          ) : (
            items.map((it: ReceiptItem, i: number) => (
              <div
                key={it.id || i}
                className="grid grid-cols-[2fr_1fr] border-t border-gray-200"
              >
                <div className="px-2 py-1.5 border-r border-gray-200 text-xs">
                  {it.deliveryNo || '-'}
                </div>
                <div className="px-2 py-1.5 text-xs text-right font-medium">
                  {it.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b">
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="delivery">送货单</TabsTrigger>
            <TabsTrigger value="return">退货单</TabsTrigger>
            <TabsTrigger value="receipt">收款单</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-3 border-b flex items-center gap-2 flex-wrap">
        <Select value={searchCustomer} onValueChange={setSearchCustomer}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="全部客户" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c: Customer) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={searchStatus} onValueChange={setSearchStatus}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="audited">已审核</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={searchStart}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchStart(e.target.value)
          }
          type="date"
          className="w-40 h-8 text-xs"
          placeholder="开始日期"
        />
        <span className="text-gray-400">至</span>
        <Input
          value={searchEnd}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchEnd(e.target.value)
          }
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

      <Tabs value={activeTab} onValueChange={() => {}}>
        <TabsContent value="delivery">
          <Table
            columns={deliveryColumns}
            dataSource={deliveryList}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1000, y: 500 }}
            pagination={{
              current: deliveryPage,
              pageSize,
              total: deliveryTotal,
              showSizeChanger: false,
              onChange: (p: number) => setDeliveryPage(p),
            }}
          />
        </TabsContent>
        <TabsContent value="return">
          <Table
            columns={returnColumns}
            dataSource={returnList}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 800, y: 500 }}
            pagination={{
              current: returnPage,
              pageSize,
              total: returnTotal,
              showSizeChanger: false,
              onChange: (p: number) => setReturnPage(p),
            }}
          />
        </TabsContent>
        <TabsContent value="receipt">
          <Table
            columns={receiptColumns}
            dataSource={receiptList}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1000, y: 500 }}
            pagination={{
              current: receiptPage,
              pageSize,
              total: receiptTotal,
              showSizeChanger: false,
              onChange: (p: number) => setReceiptPage(p),
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>
              {detailType === 'delivery'
                ? '送货单详情'
                : detailType === 'return'
                ? '退货单详情'
                : '收款单详情'}
            </DialogTitle>
          </DialogHeader>
          {renderDetailItems()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesSearchPage;
