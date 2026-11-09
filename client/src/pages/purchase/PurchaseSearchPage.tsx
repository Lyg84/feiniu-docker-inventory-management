import { useState, useCallback, useEffect, useMemo } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Search, RefreshCw, Calendar as CalendarIcon, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Badge } from '@client/src/components/ui/badge';
import { Calendar } from '@client/src/components/ui/calendar';
import QuickRangeSelect from '@client/src/components/QuickRangeSelect';
import { quickRange } from '@/lib/quick-range';
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  purchaseInApi,
  purchaseReturnApi,
  paymentApi,
  supplierApi,
} from '@client/src/api';
import type {
  PurchaseIn,
  PurchaseReturn,
  Payment,
  Supplier,
  DeliveryItem,
} from '@shared/api.interface';
import PinyinSelect from '@client/src/components/PinyinSelect';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildSupplierOptions } from '@/lib/entity-options';
import { exportToExcel, fetchAllPages, todayStamp } from '@/lib/excel-export';

type TabType = 'in' | 'return' | 'payment';

function StatusBadge({ status }: { status: string }) {
  if (status === 'audited') {
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">已审核</Badge>;
  }
  return <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">草稿</Badge>;
}

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 justify-start font-normal gap-1 w-32">
            <CalendarIcon className="w-3 h-3" />
            {startDate || <span className="text-muted-foreground">开始日期</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate ? new Date(startDate) : undefined}
            onSelect={(d) => d && onStartChange(format(d, 'yyyy-MM-dd'))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <span className="text-gray-400">~</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 justify-start font-normal gap-1 w-32">
            <CalendarIcon className="w-3 h-3" />
            {endDate || <span className="text-muted-foreground">结束日期</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate ? new Date(endDate) : undefined}
            onSelect={(d) => d && onEndChange(format(d, 'yyyy-MM-dd'))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function InDetailDialog({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: PurchaseIn | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>采购入库单详情</DialogTitle>
        </DialogHeader>
        {record && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-gray-500">入库单号：</span><span className="font-medium">{record.inNo}</span></div>
              <div><span className="text-gray-500">日期：</span><span>{record.inDate}</span></div>
              <div><span className="text-gray-500">状态：</span><StatusBadge status={record.auditStatus} /></div>
              <div><span className="text-gray-500">供应商：</span><span>{record.supplierName}</span></div>
              <div className="col-span-2"><span className="text-gray-500">备注：</span><span>{record.remark || '-'}</span></div>
            </div>
            <div className="border rounded overflow-x-auto">
              <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium">商品明细</div>
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
                  </tr>
                </thead>
                <tbody>
                  {(record.items || []).map((item: DeliveryItem, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1 text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-1">{item.productName}</td>
                      <td className="px-2 py-1">{item.spec || '-'}</td>
                      <td className="px-2 py-1">{item.unit || '-'}</td>
                      <td className="px-2 py-1 text-right">{item.quantity}</td>
                      <td className="px-2 py-1 text-right">{item.price?.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{item.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!record.items || record.items.length === 0) && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">暂无明细</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td colSpan={6} className="px-3 py-2 text-right font-medium">合计：</td>
                    <td className="px-2 py-2 text-right font-semibold text-blue-800">¥ {record.totalAmount?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">总金额：</span><span className="font-semibold text-blue-800">¥ {record.totalAmount?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">已付款：</span><span>¥ {record.paidAmount?.toFixed(2)}</span></div>
              <div><span className="text-gray-500">应付款：</span><span>¥ {record.debtAmount?.toFixed(2)}</span></div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDetailDialog({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: PurchaseReturn | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>采购退货单详情</DialogTitle>
        </DialogHeader>
        {record && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-gray-500">退货单号：</span><span className="font-medium">{record.returnNo}</span></div>
              <div><span className="text-gray-500">日期：</span><span>{record.returnDate}</span></div>
              <div><span className="text-gray-500">状态：</span><StatusBadge status={record.auditStatus} /></div>
              <div><span className="text-gray-500">供应商：</span><span>{record.supplierName}</span></div>
              <div className="col-span-2"><span className="text-gray-500">备注：</span><span>{record.remark || '-'}</span></div>
            </div>
            <div className="border rounded overflow-x-auto">
              <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium">退货明细</div>
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
                  </tr>
                </thead>
                <tbody>
                  {(record.items || []).map((item: DeliveryItem, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1 text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-1">{item.productName}</td>
                      <td className="px-2 py-1">{item.spec || '-'}</td>
                      <td className="px-2 py-1">{item.unit || '-'}</td>
                      <td className="px-2 py-1 text-right">{item.quantity}</td>
                      <td className="px-2 py-1 text-right">{item.price?.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{item.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!record.items || record.items.length === 0) && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">暂无明细</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td colSpan={6} className="px-3 py-2 text-right font-medium">合计：</td>
                    <td className="px-2 py-2 text-right font-semibold text-blue-800">¥ {record.totalAmount?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDetailDialog({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: Payment | null;
}) {
  const items = record?.items || [];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>采购付款单详情</DialogTitle>
        </DialogHeader>
        {record && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div><span className="text-gray-500">付款单号：</span><span className="font-medium">{record.paymentNo}</span></div>
              <div><span className="text-gray-500">日期：</span><span>{record.paymentDate}</span></div>
              <div><span className="text-gray-500">状态：</span><StatusBadge status={record.auditStatus} /></div>
              <div><span className="text-gray-500">供应商：</span><span>{record.supplierName}</span></div>
              <div><span className="text-gray-500">付款方式：</span><span>{record.paymentMethod || '-'}</span></div>
              <div><span className="text-gray-500">付款金额：</span><span className="font-semibold text-blue-800">¥ {record.totalAmount?.toFixed(2)}</span></div>
              <div className="col-span-2"><span className="text-gray-500">备注：</span><span>{record.remark || '-'}</span></div>
              <div><span className="text-gray-500">核销金额：</span><span>¥ {record.writeOffAmount?.toFixed(2)}</span></div>
            </div>
            <div className="border rounded overflow-x-auto">
              <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium">核销明细</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left px-2 py-2 font-medium w-10">#</th>
                    <th className="text-left px-2 py-2 font-medium">采购入库单号</th>
                    <th className="text-right px-2 py-2 font-medium w-32">核销金额</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1 text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-1">{item.inNo || '-'}</td>
                      <td className="px-2 py-1 text-right">¥ {item.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">暂无核销明细</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseSearchPage() {
  const [activeTab, setActiveTab] = useState<TabType>('in');

  const [supplierId, setSupplierId] = useState('');
  const [range, setRange] = useState('month');
  const [startDate, setStartDate] = useState(quickRange('month')[0]);
  const [endDate, setEndDate] = useState(quickRange('month')[1]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const supplierOptions = useMemo<ComboOption[]>(
    () => buildSupplierOptions(suppliers),
    [suppliers]
  );

  const [inList, setInList] = useState<PurchaseIn[]>([]);
  const [inLoading, setInLoading] = useState(false);
  const [inPage, setInPage] = useState(1);
  const [inPageSize, setInPageSize] = useState(20);
  const [inTotal, setInTotal] = useState(0);

  const [returnList, setReturnList] = useState<PurchaseReturn[]>([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnPage, setReturnPage] = useState(1);
  const [returnPageSize, setReturnPageSize] = useState(20);
  const [returnTotal, setReturnTotal] = useState(0);

  const [paymentList, setPaymentList] = useState<Payment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(20);
  const [paymentTotal, setPaymentTotal] = useState(0);

  const [searchParams, setSearchParams] = useState({
    supplierId: '',
    startDate: '',
    endDate: '',
    keyword: '',
    status: '',
  });

  const [detailIn, setDetailIn] = useState<PurchaseIn | null>(null);
  const [detailReturn, setDetailReturn] = useState<PurchaseReturn | null>(null);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supplierApi.all().then((data) => setSuppliers(data)).catch(() => {});
  }, []);

  const fetchInList = useCallback(async (p: number, ps: number, params: typeof searchParams) => {
    setInLoading(true);
    try {
      const res = await purchaseInApi.list({
        page: p,
        pageSize: ps,
        supplierId: params.supplierId,
        startDate: params.startDate,
        endDate: params.endDate,
        keyword: params.keyword,
        auditStatus: params.status,
      });
      setInList(res.items);
      setInTotal(res.total);
      setInPage(res.page);
    } finally {
      setInLoading(false);
    }
  }, []);

  const fetchReturnList = useCallback(async (p: number, ps: number, params: typeof searchParams) => {
    setReturnLoading(true);
    try {
      const res = await purchaseReturnApi.list({
        page: p,
        pageSize: ps,
        supplierId: params.supplierId,
        startDate: params.startDate,
        endDate: params.endDate,
        keyword: params.keyword,
        auditStatus: params.status,
      });
      setReturnList(res.items);
      setReturnTotal(res.total);
      setReturnPage(res.page);
    } finally {
      setReturnLoading(false);
    }
  }, []);

  const fetchPaymentList = useCallback(async (p: number, ps: number, params: typeof searchParams) => {
    setPaymentLoading(true);
    try {
      const res = await paymentApi.list({
        page: p,
        pageSize: ps,
        supplierId: params.supplierId,
        startDate: params.startDate,
        endDate: params.endDate,
        keyword: params.keyword,
        auditStatus: params.status,
      });
      setPaymentList(res.items);
      setPaymentTotal(res.total);
      setPaymentPage(res.page);
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  const handleSearch = () => {
    const params = { supplierId, startDate, endDate, keyword, status };
    setSearchParams(params);
    if (activeTab === 'in') {
      setInPage(1);
      fetchInList(1, inPageSize, params);
    } else if (activeTab === 'return') {
      setReturnPage(1);
      fetchReturnList(1, returnPageSize, params);
    } else {
      setPaymentPage(1);
      fetchPaymentList(1, paymentPageSize, params);
    }
  };

  const handleReset = () => {
    setSupplierId('');
    setRange('month');
    setStartDate(quickRange('month')[0]);
    setEndDate(quickRange('month')[1]);
    setKeyword('');
    setStatus('');
  };

  /** 选快捷时间后自动回填起止日期 */
  const handleRangeChange = (key: string) => {
    if (!key) return;
    const [start, end] = quickRange(key);
    setRange(key);
    setStartDate(start);
    setEndDate(end);
  };

  const handleRefresh = () => {
    if (activeTab === 'in') fetchInList(inPage, inPageSize, searchParams);
    else if (activeTab === 'return') fetchReturnList(returnPage, returnPageSize, searchParams);
    else fetchPaymentList(paymentPage, paymentPageSize, searchParams);
  };

  const handleViewIn = async (id: string) => {
    try {
      const data = await purchaseInApi.get(id);
      setDetailIn(data);
      setDetailOpen(true);
    } catch {
      toast.error('获取详情失败');
    }
  };

  const handleViewReturn = async (id: string) => {
    try {
      const data = await purchaseReturnApi.get(id);
      setDetailReturn(data);
      setDetailOpen(true);
    } catch {
      toast.error('获取详情失败');
    }
  };

  const handleViewPayment = async (id: string) => {
    try {
      const data = await paymentApi.get(id);
      setDetailPayment(data);
      setDetailOpen(true);
    } catch {
      toast.error('获取详情失败');
    }
  };

  /** 导出当前查询条件下的全部结果（不只是当前页） */
  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    const auditText = (v?: string): string => (v === 'audited' ? '已审核' : '草稿');
    const params = {
      supplierId: searchParams.supplierId,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      keyword: searchParams.keyword,
      auditStatus: searchParams.status,
    };
    try {
      if (activeTab === 'in') {
        const rows = await fetchAllPages<PurchaseIn>((page, pageSize) =>
          purchaseInApi.list({ ...params, page, pageSize }),
        );
        if (rows.length === 0) {
          toast.error('当前条件下没有可导出的采购入库单');
          return;
        }
        exportToExcel<PurchaseIn>({
          fileName: `采购入库单_${todayStamp()}`,
          sheetName: '采购入库单',
          rows,
          columns: [
            { header: '入库单号', value: (r: PurchaseIn) => r.inNo, width: 18 },
            { header: '日期', value: (r: PurchaseIn) => r.inDate, width: 12 },
            { header: '供应商', value: (r: PurchaseIn) => r.supplierName, width: 22 },
            { header: '总金额', value: (r: PurchaseIn) => r.totalAmount, numeric: true, width: 12 },
            { header: '已付款', value: (r: PurchaseIn) => r.paidAmount, numeric: true, width: 12 },
            { header: '应付款', value: (r: PurchaseIn) => r.debtAmount, numeric: true, width: 12 },
            { header: '状态', value: (r: PurchaseIn) => auditText(r.auditStatus), width: 10 },
          ],
          note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
        });
      } else if (activeTab === 'return') {
        const rows = await fetchAllPages<PurchaseReturn>((page, pageSize) =>
          purchaseReturnApi.list({ ...params, page, pageSize }),
        );
        if (rows.length === 0) {
          toast.error('当前条件下没有可导出的采购退货单');
          return;
        }
        exportToExcel<PurchaseReturn>({
          fileName: `采购退货单_${todayStamp()}`,
          sheetName: '采购退货单',
          rows,
          columns: [
            { header: '退货单号', value: (r: PurchaseReturn) => r.returnNo, width: 18 },
            { header: '日期', value: (r: PurchaseReturn) => r.returnDate, width: 12 },
            { header: '供应商', value: (r: PurchaseReturn) => r.supplierName, width: 22 },
            { header: '总金额', value: (r: PurchaseReturn) => r.totalAmount, numeric: true, width: 12 },
            { header: '状态', value: (r: PurchaseReturn) => auditText(r.auditStatus), width: 10 },
          ],
          note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
        });
      } else {
        const rows = await fetchAllPages<Payment>((page, pageSize) =>
          paymentApi.list({ ...params, page, pageSize }),
        );
        if (rows.length === 0) {
          toast.error('当前条件下没有可导出的采购付款单');
          return;
        }
        exportToExcel<Payment>({
          fileName: `采购付款单_${todayStamp()}`,
          sheetName: '采购付款单',
          rows,
          columns: [
            { header: '付款单号', value: (r: Payment) => r.paymentNo, width: 18 },
            { header: '日期', value: (r: Payment) => r.paymentDate, width: 12 },
            { header: '供应商', value: (r: Payment) => r.supplierName, width: 22 },
            { header: '付款金额', value: (r: Payment) => r.totalAmount, numeric: true, width: 12 },
            { header: '核销金额', value: (r: Payment) => r.writeOffAmount, numeric: true, width: 12 },
            { header: '付款方式', value: (r: Payment) => r.paymentMethod ?? '', width: 12 },
            { header: '状态', value: (r: Payment) => auditText(r.auditStatus), width: 10 },
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

  const inColumns: TableColumnsType<PurchaseIn> = [
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
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_: unknown, record: PurchaseIn) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewIn(record.id)} className="h-7 px-2">
          <Eye className="w-3 h-3" />
          查看
        </Button>
      ),
    },
  ];

  const returnColumns: TableColumnsType<PurchaseReturn> = [
    { title: '退货单号', dataIndex: 'returnNo', width: 160, fixed: 'left' },
    { title: '日期', dataIndex: 'returnDate', width: 110 },
    { title: '供应商', dataIndex: 'supplierName', width: 180, ellipsis: true },
    { title: '总金额', dataIndex: 'totalAmount', width: 120, align: 'right',
      render: (v: number) => `¥ ${(v || 0).toFixed(2)}` },
    { title: '状态', dataIndex: 'auditStatus', width: 100,
      render: (v: string) => <StatusBadge status={v} /> },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_: unknown, record: PurchaseReturn) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewReturn(record.id)} className="h-7 px-2">
          <Eye className="w-3 h-3" />
          查看
        </Button>
      ),
    },
  ];

  const paymentColumns: TableColumnsType<Payment> = [
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
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_: unknown, record: Payment) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewPayment(record.id)} className="h-7 px-2">
          <Eye className="w-3 h-3" />
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <div className="text-base font-semibold text-gray-800 mb-3">采购单据查找</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-48">
            <Label>供应商</Label>
            <PinyinSelect
              value={supplierId}
              options={supplierOptions}
              onChange={setSupplierId}
              placeholder="全部供应商"
              className="h-8"
            />
          </div>
          <div className="space-y-1 w-24">
            <Label>快捷时间</Label>
            <QuickRangeSelect value={range} onChange={handleRangeChange} className="h-8 w-24" />
          </div>
          <div className="space-y-1">
            <Label>日期范围</Label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartChange={(v) => {
                setStartDate(v);
                setRange('');
              }}
              onEndChange={(v) => {
                setEndDate(v);
                setRange('');
              }}
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label>关键字</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="单号/备注"
              className="h-8"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="space-y-1 w-28">
            <Label>状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="audited">已审核</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Button size="sm" variant="default" onClick={handleSearch}>
              <Search className="w-3 h-3" />
              查询
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>重置</Button>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-3 h-3" />
              刷新
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleExport()} disabled={exporting}>
              <Download className="w-3 h-3" />
              {exporting ? '导出中…' : '导出 Excel'}
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <div className="px-3 pt-3 border-b">
          <TabsList>
            <TabsTrigger value="in">采购入库单</TabsTrigger>
            <TabsTrigger value="return">采购退货单</TabsTrigger>
            <TabsTrigger value="payment">采购付款单</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="in" className="m-0">
          <Table<PurchaseIn>
            columns={inColumns}
            dataSource={inList}
            rowKey="id"
            loading={inLoading}
            scroll={{ x: 1100, y: 480 }}
            size="small"
            pagination={{
              current: inPage,
              pageSize: inPageSize,
              total: inTotal,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setInPage(p);
                setInPageSize(ps);
                fetchInList(p, ps, searchParams);
              },
            }}
          />
        </TabsContent>
        <TabsContent value="return" className="m-0">
          <Table<PurchaseReturn>
            columns={returnColumns}
            dataSource={returnList}
            rowKey="id"
            loading={returnLoading}
            scroll={{ x: 900, y: 480 }}
            size="small"
            pagination={{
              current: returnPage,
              pageSize: returnPageSize,
              total: returnTotal,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setReturnPage(p);
                setReturnPageSize(ps);
                fetchReturnList(p, ps, searchParams);
              },
            }}
          />
        </TabsContent>
        <TabsContent value="payment" className="m-0">
          <Table<Payment>
            columns={paymentColumns}
            dataSource={paymentList}
            rowKey="id"
            loading={paymentLoading}
            scroll={{ x: 1100, y: 480 }}
            size="small"
            pagination={{
              current: paymentPage,
              pageSize: paymentPageSize,
              total: paymentTotal,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPaymentPage(p);
                setPaymentPageSize(ps);
                fetchPaymentList(p, ps, searchParams);
              },
            }}
          />
        </TabsContent>
      </Tabs>

      <InDetailDialog
        open={detailOpen && activeTab === 'in'}
        onClose={() => { setDetailOpen(false); setDetailIn(null); }}
        record={detailIn}
      />
      <ReturnDetailDialog
        open={detailOpen && activeTab === 'return'}
        onClose={() => { setDetailOpen(false); setDetailReturn(null); }}
        record={detailReturn}
      />
      <PaymentDetailDialog
        open={detailOpen && activeTab === 'payment'}
        onClose={() => { setDetailOpen(false); setDetailPayment(null); }}
        record={detailPayment}
      />
    </div>
  );
}
