import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, type TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Search, Eye, Download } from 'lucide-react';
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
import PinyinSelect from '@client/src/components/PinyinSelect';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildCustomerOptions } from '@/lib/entity-options';
import { exportToExcel, fetchAllPages, todayStamp } from '@/lib/excel-export';

type TabKey = 'delivery' | 'return' | 'receipt';

const SalesSearchPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('delivery');
  const [customers, setCustomers] = useState<Customer[]>([]);

  const customerOptions = useMemo<ComboOption[]>(
    () => buildCustomerOptions(customers),
    [customers]
  );

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
  const [exporting, setExporting] = useState<boolean>(false);
  const [pageSize] = useState<number>(20);

  // detail dialog
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailType, setDetailType] = useState<TabKey>('delivery');
  const [detailData, setDetailData] = useState<SalesDelivery | SalesReturn | Receipt | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // 退货弹窗：从当前送货单勾选商品直接生成退货单
  const [returnPickOpen, setReturnPickOpen] = useState<boolean>(false);
  const [returnPickRows, setReturnPickRows] = useState<
    { key: string; checked: boolean; quantity: number; item: DeliveryItem }[]
  >([]);
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);

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

  /** 导出当前查询条件下的全部结果（不只是当前页） */
  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    const baseParams: Record<string, unknown> = {};
    if (searchCustomer) baseParams.customerId = searchCustomer;
    if (searchStatus) baseParams.auditStatus = searchStatus;
    if (searchKeyword) baseParams.keyword = searchKeyword;
    if (searchStart) baseParams.startDate = searchStart;
    if (searchEnd) baseParams.endDate = searchEnd;
    const auditText = (v?: string): string => (v === 'audited' ? '已审核' : '草稿');
    try {
      if (activeTab === 'delivery') {
        const rows = await fetchAllPages<SalesDelivery>((page, pageSize) =>
          salesDeliveryApi.list({ ...baseParams, page: String(page), pageSize: String(pageSize) }),
        );
        if (rows.length === 0) {
          toast.error('当前条件下没有可导出的送货单');
          return;
        }
        exportToExcel<SalesDelivery>({
          fileName: `销售送货单_${todayStamp()}`,
          sheetName: '送货单',
          rows,
          columns: [
            { header: '送货单号', value: (r: SalesDelivery) => r.orderNo, width: 18 },
            { header: '日期', value: (r: SalesDelivery) => r.orderDate, width: 12 },
            { header: '客户名称', value: (r: SalesDelivery) => r.customerName, width: 22 },
            { header: '总金额', value: (r: SalesDelivery) => r.totalAmount, numeric: true, width: 12 },
            { header: '已收款', value: (r: SalesDelivery) => r.paidAmount, numeric: true, width: 12 },
            { header: '欠款', value: (r: SalesDelivery) => r.debtAmount, numeric: true, width: 12 },
            { header: '状态', value: (r: SalesDelivery) => auditText(r.auditStatus), width: 10 },
          ],
          note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
        });
      } else if (activeTab === 'return') {
        const rows = await fetchAllPages<SalesReturn>((page, pageSize) =>
          salesReturnApi.list({ ...baseParams, page: String(page), pageSize: String(pageSize) }),
        );
        if (rows.length === 0) {
          toast.error('当前条件下没有可导出的退货单');
          return;
        }
        exportToExcel<SalesReturn>({
          fileName: `销售退货单_${todayStamp()}`,
          sheetName: '退货单',
          rows,
          columns: [
            { header: '退货单号', value: (r: SalesReturn) => r.returnNo, width: 18 },
            { header: '日期', value: (r: SalesReturn) => r.returnDate, width: 12 },
            { header: '客户名称', value: (r: SalesReturn) => r.customerName, width: 22 },
            { header: '总金额', value: (r: SalesReturn) => r.totalAmount, numeric: true, width: 12 },
            { header: '状态', value: (r: SalesReturn) => auditText(r.auditStatus), width: 10 },
            { header: '原送货单', value: (r: SalesReturn) => r.deliveryNo ?? '', width: 18 },
          ],
          note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
        });
      } else {
        const rows = await fetchAllPages<Receipt>((page, pageSize) =>
          receiptApi.list({ ...baseParams, page: String(page), pageSize: String(pageSize) }),
        );
        if (rows.length === 0) {
          toast.error('当前条件下没有可导出的收款单');
          return;
        }
        exportToExcel<Receipt>({
          fileName: `销售收款单_${todayStamp()}`,
          sheetName: '收款单',
          rows,
          columns: [
            { header: '收款单号', value: (r: Receipt) => r.receiptNo, width: 18 },
            { header: '日期', value: (r: Receipt) => r.receiptDate, width: 12 },
            { header: '客户名称', value: (r: Receipt) => r.customerName, width: 22 },
            { header: '收款金额', value: (r: Receipt) => r.totalAmount, numeric: true, width: 12 },
            { header: '核销金额', value: (r: Receipt) => r.writeOffAmount, numeric: true, width: 12 },
            { header: '收款方式', value: (r: Receipt) => r.paymentMethod ?? '', width: 12 },
            { header: '状态', value: (r: Receipt) => auditText(r.auditStatus), width: 10 },
          ],
          note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
        });
      }
      toast.success('已导出 Excel');
    } catch {
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const viewDelivery = async (record: SalesDelivery): Promise<void> => {
    setDetailType('delivery');
    setDetailData(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await salesDeliveryApi.get(record.id);
      if (detail) setDetailData(detail);
    } catch {
      toast.error('加载送货单明细失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const viewReturn = async (record: SalesReturn): Promise<void> => {
    setDetailType('return');
    setDetailData(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await salesReturnApi.get(record.id);
      if (detail) setDetailData(detail);
    } catch {
      toast.error('加载退货单明细失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const viewReceipt = async (record: Receipt): Promise<void> => {
    setDetailType('receipt');
    setDetailData(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await receiptApi.get(record.id);
      if (detail) setDetailData(detail);
    } catch {
      toast.error('加载收款单明细失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const openReturnPick = (): void => {
    if (detailType !== 'delivery' || !detailData) return;
    const d = detailData as SalesDelivery;
    const list: DeliveryItem[] = d.items || [];
    if (list.length === 0) {
      toast.error('当前单据没有商品明细，无法退货');
      return;
    }
    setReturnPickRows(
      list.map((it: DeliveryItem, i: number) => ({
        key: it.id || `row-${i}`,
        checked: true,
        quantity: it.quantity,
        item: it,
      })),
    );
    setReturnPickOpen(true);
  };

  const toggleReturnRow = (key: string): void => {
    setReturnPickRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, checked: !r.checked } : r)),
    );
  };

  const changeReturnQty = (key: string, raw: string): void => {
    const num = Number(raw);
    setReturnPickRows((rows) =>
      rows.map((r) => {
        if (r.key !== key) return r;
        const max = r.item.quantity;
        const qty = Number.isFinite(num) ? Math.min(Math.max(num, 0), max) : 0;
        return { ...r, quantity: qty };
      }),
    );
  };

  const returnPickTotal = useMemo<number>(
    () =>
      returnPickRows.reduce(
        (sum, r) => (r.checked ? sum + r.quantity * r.item.price : sum),
        0,
      ),
    [returnPickRows],
  );

  const submitReturnFromDelivery = (): void => {
    if (detailType !== 'delivery' || !detailData) return;
    const d = detailData as SalesDelivery;
    const picked = returnPickRows.filter((r) => r.checked && r.quantity > 0);
    if (picked.length === 0) {
      toast.error('请至少选择一件退货商品，并填写退货数量');
      return;
    }
    const items: DeliveryItem[] = picked.map((r, idx) => ({
      productId: r.item.productId,
      productName: r.item.productName,
      spec: r.item.spec,
      unit: r.item.unit,
      quantity: r.quantity,
      price: r.item.price,
      amount: Number((r.quantity * r.item.price).toFixed(2)),
      sortOrder: idx,
    }));
    const totalAmount = Number(
      items.reduce((sum, it) => sum + it.amount, 0).toFixed(2),
    );

    setReturnSubmitting(true);
    salesReturnApi
      .create({
        customerId: d.customerId,
        returnDate: new Date().toISOString().slice(0, 10),
        deliveryId: d.id,
        remark: `由送货单 ${d.orderNo} 退货`,
        totalAmount,
        items,
      })
      .then(() => {
        toast.success('退货单已生成，可到「退货单」查看并审核');
        setReturnPickOpen(false);
        setDetailOpen(false);
        setReturnPage(1);
        setActiveTab('return');
      })
      .catch(() => toast.error('生成退货单失败'))
      .finally(() => setReturnSubmitting(false));
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
          onClick={() => void viewDelivery(record)}
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
          onClick={() => void viewReturn(record)}
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
          onClick={() => void viewReceipt(record)}
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
            {items.length === 0 ? (
              <div className="border-t border-gray-200 px-2 py-4 text-center text-xs text-gray-400">
                {detailLoading ? '明细加载中…' : '无商品明细'}
              </div>
            ) : items.map((it: DeliveryItem, i: number) => (
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
            {items.length === 0 ? (
              <div className="border-t border-gray-200 px-2 py-4 text-center text-xs text-gray-400">
                {detailLoading ? '明细加载中…' : '无商品明细'}
              </div>
            ) : items.map((it: DeliveryItem, i: number) => (
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

  const pickDelivery: SalesDelivery | null =
    detailType === 'delivery' ? (detailData as SalesDelivery | null) : null;

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
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exporting}
        >
          <Download size={14} /> {exporting ? '导出中…' : '导出 Excel'}
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
            {detailType === 'delivery' && (
              <Button size="sm" variant="default" onClick={openReturnPick} disabled={detailLoading}>
                退货
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnPickOpen} onOpenChange={setReturnPickOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <DialogTitle>选择退货商品</DialogTitle>
          </DialogHeader>

          <div className="flex gap-4 text-xs text-gray-500">
            <span>原送货单：{pickDelivery?.orderNo || '-'}</span>
            <span>客户：{pickDelivery?.customerName || '-'}</span>
          </div>

          <div className="border border-gray-200 rounded text-sm">
            <div className="grid grid-cols-[0.4fr_2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.9fr] bg-gray-50 text-xs font-semibold text-gray-700">
              <div className="px-2 py-1.5 border-r border-gray-200 text-center">选</div>
              <div className="px-2 py-1.5 border-r border-gray-200">商品名称</div>
              <div className="px-2 py-1.5 border-r border-gray-200">规格</div>
              <div className="px-2 py-1.5 border-r border-gray-200">单位</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">原数量</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">退货数量</div>
              <div className="px-2 py-1.5 border-r border-gray-200 text-right">单价</div>
              <div className="px-2 py-1.5 text-right">金额</div>
            </div>
            {returnPickRows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[0.4fr_2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.9fr] border-t border-gray-200 items-center"
              >
                <div className="px-2 py-1 flex justify-center">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={() => toggleReturnRow(row.key)}
                  />
                </div>
                <div className="px-2 py-1 border-r border-gray-200 text-xs">
                  {row.item.productName}
                </div>
                <div className="px-2 py-1 border-r border-gray-200 text-xs">
                  {row.item.spec || '-'}
                </div>
                <div className="px-2 py-1 border-r border-gray-200 text-xs">
                  {row.item.unit || '-'}
                </div>
                <div className="px-2 py-1 border-r border-gray-200 text-xs text-right">
                  {row.item.quantity}
                </div>
                <div className="px-1 py-1 border-r border-gray-200 text-right">
                  <input
                    type="number"
                    value={row.quantity}
                    min={0}
                    max={row.item.quantity}
                    step="any"
                    disabled={!row.checked}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      changeReturnQty(row.key, e.target.value)
                    }
                    className="w-16 h-7 px-1 text-xs text-right border border-gray-300 rounded disabled:bg-gray-100"
                  />
                </div>
                <div className="px-2 py-1 border-r border-gray-200 text-xs text-right">
                  {row.item.price.toFixed(2)}
                </div>
                <div className="px-2 py-1 text-xs text-right font-medium">
                  {(row.checked ? row.quantity * row.item.price : 0).toFixed(2)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[0.4fr_2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.9fr] border-t border-gray-200 bg-gray-50 text-sm font-semibold">
              <div className="px-2 py-1.5 col-span-7 text-right text-gray-700">退货合计：</div>
              <div className="px-2 py-1.5 text-right text-red-600">
                ¥{returnPickTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            退货数量不得超过原单据数量；生成的退货单为草稿，到「退货单」页审核后才加回库存、冲减客户欠款。
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReturnPickOpen(false)}
              disabled={returnSubmitting}
            >
              取消
            </Button>
            <Button size="sm" onClick={submitReturnFromDelivery} disabled={returnSubmitting}>
              {returnSubmitting ? '生成中…' : '生成退货单'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesSearchPage;
