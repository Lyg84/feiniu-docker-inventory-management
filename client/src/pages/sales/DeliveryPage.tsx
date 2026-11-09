import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, type TableColumnsType } from 'antd';
import { Plus, Search, Eye, Pencil, Trash2, CheckCircle, RotateCcw, History, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import PinyinAutoComplete, { type ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildDeliveryTicketHtml, ticketPageSize } from '@/lib/print/delivery-ticket';
import {
  DEFAULT_PAPER_KEY,
  PRINT_PAPER_PARAM_KEY,
  getPaperPreset,
} from '@/lib/print/paper-presets';
import {
  ensurePrintClient,
  launchPrintClient,
  printHtml,
  subscribePrintState,
  type PrintClientState,
} from '@/lib/print/hiprint-client';
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

import { salesDeliveryApi, customerApi, productApi, systemApi } from '@client/src/api';
import { buildProductOptions } from '@/lib/product-options';
import { buildCustomerOptions } from '@/lib/entity-options';
import PinyinSelect from '@client/src/components/PinyinSelect';
import QuickRangeSelect from '@client/src/components/QuickRangeSelect';
import { quickRange } from '@/lib/quick-range';
import type { SalesDelivery, DeliveryItem, Customer, Product, PriceHistory } from '@shared/api.interface';
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
  quantity: 1,
  price: 0,
  amount: 0,
});

/** 把后端返回的 message 提出来给用户看，别一律是「失败」 */
function apiErrText(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  return fallback;
}

const DeliveryPage: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [list, setList] = useState<SalesDelivery[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // search
  const [searchCustomer, setSearchCustomer] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchRange, setSearchRange] = useState<string>('month');
  const [searchStart, setSearchStart] = useState<string>(quickRange('month')[0]);
  const [searchEnd, setSearchEnd] = useState<string>(quickRange('month')[1]);

  // dialog
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<boolean>(false);
  const [formCustomer, setFormCustomer] = useState<string>('');
  /** 客户输入框里显示的名字：可以是已选客户，也可以是手动敲的新名字 */
  const [customerInput, setCustomerInput] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(todayStr());
  const [formRemark, setFormRemark] = useState<string>('');
  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()]);
  const [formAudited, setFormAudited] = useState<boolean>(false);
  /** 当前编辑单据的单号，打印时用；新建未保存时为空 */
  const [formOrderNo, setFormOrderNo] = useState<string>('');

  // customer / product options
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [optionsLoading, setOptionsLoading] = useState<boolean>(false);

  // price history
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState<boolean>(false);
  const [activePriceRow, setActivePriceRow] = useState<string | null>(null);

  // print
  const [printState, setPrintState] = useState<PrintClientState>({
    connected: false,
    connecting: false,
    printers: [],
  });
  const [printerName, setPrinterName] = useState<string>(
    () => localStorage.getItem('jxc.print.printer') || ''
  );
  const [printing, setPrinting] = useState<boolean>(false);

  // 打印纸型 / 公司名：来自系统参数设置
  const [paperKey, setPaperKey] = useState<string>(DEFAULT_PAPER_KEY);
  const [companyName, setCompanyName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactAddress, setContactAddress] = useState<string>('');

  // 列表勾选（批量打印 / 批量审核）
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<SalesDelivery[]>([]);
  const [batchBusy, setBatchBusy] = useState<boolean>(false);
  const [batchDone, setBatchDone] = useState<number>(0);
  const [batchTotal, setBatchTotal] = useState<number>(0);

  /** 商品候选：按 名称+规格+单位 区分，同名不同规格各占一条；显示文本重复时再补单位区分 */
  const productOptions = useMemo<ComboOption[]>(
    () => buildProductOptions(products),
    [products]
  );

  const customerOptions = useMemo<ComboOption[]>(
    () =>
      customers.map((c: Customer) => ({
        value: c.name,
        label: c.name,
        hint: [c.phone, c.address].filter(Boolean).join(' · '),
        extra: [c.contactPerson, c.phone, c.address],
      })),
    [customers]
  );

  /** 顶部筛选的客户候选，按客户 id 取值 */
  const customerIdOptions = useMemo<ComboOption[]>(
    () => buildCustomerOptions(customers),
    [customers]
  );

  // 打印客户端连接：页面打开即尝试连本机 17521
  useEffect(() => {
    const unsubscribe = subscribePrintState((s: PrintClientState) => setPrintState(s));
    ensurePrintClient();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (printerName) localStorage.setItem('jxc.print.printer', printerName);
    else localStorage.removeItem('jxc.print.printer');
  }, [printerName]);

  const totalAmount = useMemo<number>(
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
    salesDeliveryApi
      .list(params)
      .then((res) => {
        setList(res.items);
        setTotal(res.total);
      })
      .catch(() => toast.error('加载送货单列表失败'))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchCustomer, searchStatus, searchKeyword, searchStart, searchEnd]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setOptionsLoading(true);
    Promise.all([customerApi.all(), productApi.all()])
      .then(([custs, prods]) => {
        setCustomers(custs);
        setProducts(prods);
      })
      .catch(() => toast.error('加载基础资料失败'))
      .finally(() => setOptionsLoading(false));
  }, []);

  // 读取系统参数：打印纸型、公司名称、联系方式
  useEffect(() => {
    systemApi
      .paramList()
      .then((params) => {
        const paper = params.find((p) => p.paramKey === PRINT_PAPER_PARAM_KEY)?.paramValue;
        if (paper) setPaperKey(paper);
        const company = params.find((p) => p.paramKey === 'company_name')?.paramValue;
        if (company) setCompanyName(company);
        const person = params.find((p) => p.paramKey === 'contact_person')?.paramValue;
        if (person) setContactPerson(person);
        const phone = params.find((p) => p.paramKey === 'contact_phone')?.paramValue;
        if (phone) setContactPhone(phone);
        const address = params.find((p) => p.paramKey === 'contact_address')?.paramValue;
        if (address) setContactAddress(address);
      })
      .catch(() => {
        /* 参数接口失败就按默认纸型打印，不挡开单 */
      });
  }, []);

  const paperPreset = useMemo(() => getPaperPreset(paperKey), [paperKey]);

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
    setFormOrderNo('');
    setFormCustomer('');
    setCustomerInput('');
    setFormDate(todayStr());
    setFormRemark('');
    setFormItems([emptyItem()]);
    setDialogOpen(true);
  };

  /**
   * 打开查看/编辑弹窗，明细按 id 调详情接口补全。
   */
  const openEdit = async (record: SalesDelivery, viewOnly: boolean = false): Promise<void> => {
    let detail: SalesDelivery | null = null;
    try {
      detail = await salesDeliveryApi.get(record.id);
    } catch {
      toast.error('读取单据明细失败，先按列表摘要显示');
    }
    const src: SalesDelivery = detail ?? record;
    setEditId(record.id);
    setViewMode(viewOnly);
    setFormOrderNo(src.orderNo || record.orderNo);
    setFormCustomer(src.customerId || record.customerId);
    setCustomerInput(
      src.customerName ||
        record.customerName ||
        customers.find((c: Customer) => c.id === (src.customerId || record.customerId))?.name ||
        ''
    );
    setFormDate(src.orderDate || record.orderDate);
    setFormRemark(src.remark || '');
    setFormAudited(isAudited(src));
    setFormItems(
      (src.items || []).map((it: DeliveryItem) => ({
        ...it,
        _key: it.id || Math.random().toString(36).slice(2, 10),
      }))
    );
    setDialogOpen(true);
  };

  const isAudited = (record: SalesDelivery): boolean => record.auditStatus === 'audited';

  const handleAudit = (record: SalesDelivery): void => {
    salesDeliveryApi
      .audit(record.id)
      .then(() => {
        toast.success('审核成功');
        loadList();
      })
      .catch((err: unknown) => toast.error(apiErrText(err, '审核失败')));
  };

  const handleUnaudit = (record: SalesDelivery): void => {
    salesDeliveryApi
      .unaudit(record.id)
      .then(() => {
        toast.success('反审核成功');
        loadList();
      })
      .catch((err: unknown) => toast.error(apiErrText(err, '反审核失败')));
  };

  const handleDelete = async (record: SalesDelivery): Promise<void> => {
    if (!await showConfirm(`确认删除送货单 ${record.orderNo}？`)) return;
    salesDeliveryApi
      .remove(record.id)
      .then(() => {
        toast.success('删除成功');
        loadList();
      })
      .catch(() => toast.error('删除失败'));
  };

  const clearSelection = (): void => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  /** 批量审核：只处理勾选里的草稿，逐张下发并统计结果 */
  const handleBatchAudit = async (): Promise<void> => {
    const drafts = selectedRows.filter((r: SalesDelivery) => !isAudited(r));
    if (drafts.length === 0) {
      toast.error('勾选的单据都是已审核状态，无需批量审核');
      return;
    }
    setBatchBusy(true);
    setBatchDone(0);
    setBatchTotal(drafts.length);
    let ok = 0;
    const failed: string[] = [];
    for (const record of drafts) {
      try {
        await salesDeliveryApi.audit(record.id);
        ok += 1;
      } catch (err: unknown) {
        failed.push(`${record.orderNo}（${apiErrText(err, '审核失败')}）`);
      }
      setBatchDone(ok + failed.length);
    }
    setBatchBusy(false);
    clearSelection();
    loadList();
    if (failed.length === 0) {
      toast.success(`已审核 ${ok} 张送货单`);
    } else {
      toast.error(
        `成功 ${ok} 张，失败 ${failed.length} 张：${failed.slice(0, 3).join('；')}${failed.length > 3 ? ' …' : ''}`,
      );
    }
  };

  /** 批量打印：逐张取明细串行下发，避免一次怼给打印端 */
  const handleBatchPrint = async (): Promise<void> => {
    if (!printState.connected) {
      toast.error('未连接到打印客户端，请先启动 electron-hiprint 打印端');
      return;
    }
    if (selectedRows.length === 0) return;
    setBatchBusy(true);
    setBatchDone(0);
    setBatchTotal(selectedRows.length);
    let ok = 0;
    const failed: string[] = [];
    for (const record of selectedRows) {
      try {
        const detail = await salesDeliveryApi.get(record.id);
        const sent = await sendTicket({
          id: detail.id,
          orderNo: detail.orderNo,
          orderDate: detail.orderDate,
          customerName:
            detail.customerName ||
            customers.find((c: Customer) => c.id === detail.customerId)?.name ||
            '',
          customerPhone: customers.find((c: Customer) => c.id === detail.customerId)?.phone,
          items: (detail.items || []).map((it: DeliveryItem) => ({
            productName: it.productName,
            spec: it.spec,
            unit: it.unit,
            quantity: it.quantity,
            price: it.price,
            amount: it.amount,
          })),
          totalAmount: detail.totalAmount,
          remark: detail.remark,
          quiet: true,
        });
        if (sent) ok += 1;
        else failed.push(`${record.orderNo}（打印端未回执）`);
      } catch {
        failed.push(`${record.orderNo}（取明细失败）`);
      }
      setBatchDone(ok + failed.length);
    }
    setBatchBusy(false);
    loadList();
    if (failed.length === 0) {
      toast.success(`已发送 ${ok} 张送货单到打印端`);
      clearSelection();
    } else {
      toast.error(
        `成功 ${ok} 张，失败 ${failed.length} 张：${failed.slice(0, 3).join('；')}${failed.length > 3 ? ' …' : ''}`,
      );
    }
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

  /**
   * 拉取该客户买该商品的历史成交价。
   * autoFill=true 时把上次成交价直接写进单价（只在价格还等于商品资料价、没被手改时覆盖）。
   */
  const loadPriceHistory = useCallback(
    (key: string, productName: string, customerId: string, autoFill: boolean): void => {
      if (!productName || !customerId) {
        setPriceHistory([]);
        return;
      }
      setActivePriceRow(key);
      setPriceHistoryLoading(true);
      productApi
        .priceHistory(productName, customerId)
        .then((history: PriceHistory[]) => {
          setPriceHistory(history);
          if (!autoFill || history.length === 0) return;
          const lastPrice = history[0].price;
          const defaultPrice =
            products.find((p: Product) => p.name === productName)?.price ?? 0;
          setFormItems((prev: FormItem[]) =>
            prev.map((it: FormItem) => {
              if (it._key !== key) return it;
              const untouched = !it.price || Math.abs(it.price - defaultPrice) < 1e-9;
              if (!untouched) return it;
              return {
                ...it,
                price: lastPrice,
                amount: Number(((it.quantity || 0) * lastPrice).toFixed(2)),
              };
            })
          );
        })
        .catch(() => setPriceHistory([]))
        .finally(() => setPriceHistoryLoading(false));
    },
    [products]
  );

  /** 选中某个具体商品（同名多规格时靠 payload 精确取到那一条） */
  const applyProduct = (key: string, prod: Product): void => {
    updateItem(key, {
      productName: prod.name,
      productId: prod.id,
      spec: prod.spec || '',
      unit: prod.unit || '',
      price: prod.price || 0,
    });
    loadPriceHistory(key, prod.name, formCustomer, true);
  };

  const handleProductChange = (key: string, productName: string): void => {
    const prod = products.find((p: Product) => p.name === productName);
    if (prod) {
      applyProduct(key, prod);
      return;
    }
    updateItem(key, { productName });
    loadPriceHistory(key, productName, formCustomer, true);
  };

  /** 手改了规格/单位后，按「名称+规格」重新挂回档案；挂不上就解绑，保存时后端按名称+规格建档 */
  const rebindBySpec = (key: string, name: string, spec: string): void => {
    const hit = products.find(
      (p: Product) => p.name === name && (p.spec || '') === (spec || ''),
    );
    if (!hit) {
      updateItem(key, { productId: undefined });
      return;
    }
    const cur = formItems.find((it: FormItem) => it._key === key);
    const patch: Partial<FormItem> = {
      productId: hit.id,
      spec: hit.spec || '',
      unit: cur?.unit || hit.unit || '',
    };
    if ((cur?.price ?? 0) <= 0 && (hit.price ?? 0) > 0) {
      patch.price = hit.price;
    }
    updateItem(key, patch);
  };

  const resetPricePanel = (): void => {
    setPriceHistory([]);
    setActivePriceRow(null);
  };

  /** 换了客户：把已填商品的行重新按新客户带一次价 */
  const refreshPricesForCustomer = (customerId: string): void => {
    if (!customerId) return;
    formItems.forEach((it: FormItem) => {
      if (it.productName) loadPriceHistory(it._key, it.productName, customerId, true);
    });
  };

  /** 输入变化：能匹配到已有客户就锁定 id；匹配不上就当作新客户，保存时自动建档 */
  const handleCustomerInputChange = (value: string): void => {
    setCustomerInput(value);
    const name = value.trim();
    const hit = customers.find((c: Customer) => c.name === name);
    if (hit) {
      if (hit.id !== formCustomer) {
        setFormCustomer(hit.id);
        refreshPricesForCustomer(hit.id);
      }
    } else if (formCustomer) {
      setFormCustomer('');
      resetPricePanel();
    }
  };

  /** 从候选列表里点选一项 */
  const handleCustomerSelect = (value: string): void => {
    setCustomerInput(value);
    const hit = customers.find((c: Customer) => c.name === value);
    if (hit) {
      setFormCustomer(hit.id);
      refreshPricesForCustomer(hit.id);
    }
  };

  const applyHistoryPrice = (price: number): void => {
    if (!activePriceRow) return;
    updateItem(activePriceRow, { price });
  };

  const handleSave = async (): Promise<void> => {
    if (formItems.some((it: FormItem) => !it.productName)) {
      toast.error('请选择商品名称');
      return;
    }
    if (formItems.some((it: FormItem) => it.quantity <= 0 || it.price < 0)) {
      toast.error('请填写正确的数量和单价');
      return;
    }

    const typedName = customerInput.trim();
    let customerId = formCustomer;

    if (!customerId) {
      if (!typedName) {
        toast.error('请输入客户名称');
        return;
      }
      const hit = customers.find((c: Customer) => c.name === typedName);
      if (hit) {
        customerId = hit.id;
      } else {
        // 手敲的客户名在库里不存在 → 自动建档，开单后立刻可用
        try {
          const created = await customerApi.create({ name: typedName });
          customerId = created.id;
          setCustomers((prev: Customer[]) => [...prev, created]);
          toast.success(`已自动新建客户「${created.name}」`);
        } catch {
          // 多半是重名（409），重拉列表把已存在的 id 找回来
          try {
            const all = await customerApi.all();
            setCustomers(all);
            const found = all.find((c: Customer) => c.name === typedName);
            if (found) customerId = found.id;
          } catch {
            // 忽略，下面统一报错
          }
        }
      }
      if (!customerId) {
        toast.error('客户建档失败，请重试');
        return;
      }
      setFormCustomer(customerId);
    }

    const payload = {
      customerId,
      orderDate: formDate,
      remark: formRemark,
      totalAmount,
      items: formItems.map(({ _key, ...rest }) => rest),
    };
    const req = editId
      ? salesDeliveryApi.update(editId, payload)
      : salesDeliveryApi.create(payload);
    req
      .then(() => {
        toast.success(editId ? '修改成功' : '新增成功');
        setDialogOpen(false);
        loadList();
      })
      .catch(() => toast.error(editId ? '修改失败' : '新增失败'));
  };

  /** 组装送货单并下发到本机 electron-hiprint 客户端 */
  const sendTicket = async (payload: {
    id: string | null;
    orderNo: string;
    orderDate: string;
    customerName: string;
    customerPhone?: string;
    items: Array<{
      productName: string;
      spec?: string;
      unit?: string;
      quantity: number;
      price: number;
      amount: number;
    }>;
    totalAmount: number;
    remark?: string;
    /** 批量打印时不弹 per-item 提示 */
    quiet?: boolean;
  }): Promise<boolean> => {
    if (!printState.connected) {
      toast.error('未连接到打印客户端，请先启动 electron-hiprint 打印端');
      return false;
    }
    const html = buildDeliveryTicketHtml(
      {
        companyName: companyName || undefined,
        contactPerson: contactPerson || undefined,
        contactPhone: contactPhone || undefined,
        contactAddress: contactAddress || undefined,
        orderNo: payload.orderNo,
        orderDate: payload.orderDate,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        items: payload.items,
        totalAmount: payload.totalAmount,
        remark: payload.remark,
      },
      paperKey,
    );

    if (!payload.quiet) setPrinting(true);
    try {
      const res = await printHtml(html, {
        printer: printerName || undefined,
        pageSize: ticketPageSize(paperKey),
      });
      if (!res.ok) {
        toast.error(res.message || '打印失败');
        return false;
      }
      if (!payload.quiet) toast.success('打印任务已发送');
      // 已保存的单据才回写打印状态
      if (payload.id) {
        try {
          await salesDeliveryApi.markPrinted(payload.id);
          if (!payload.quiet) loadList();
        } catch {
          toast.error('打印成功，但打印状态回写失败');
        }
      }
      return true;
    } finally {
      if (!payload.quiet) setPrinting(false);
    }
  };

  /** 弹窗内打印：直接打印当前正在编辑的内容 */
  const handlePrintForm = (): void => {
    void sendTicket({
      id: editId,
      orderNo: formOrderNo || '（未保存单据）',
      orderDate: formDate,
      customerName:
        customerInput.trim() ||
        customers.find((c: Customer) => c.id === formCustomer)?.name ||
        '',
      customerPhone: customers.find((c: Customer) => c.id === formCustomer)?.phone,
      items: formItems.map((it: FormItem) => ({
        productName: it.productName,
        spec: it.spec,
        unit: it.unit,
        quantity: it.quantity,
        price: it.price,
        amount: it.amount,
      })),
      totalAmount,
      remark: formRemark,
    });
  };

  /** 列表行打印：先取单据明细再打印 */
  const handlePrintRecord = async (record: SalesDelivery): Promise<void> => {
    try {
      const detail = await salesDeliveryApi.get(record.id);
      await sendTicket({
        id: detail.id,
        orderNo: detail.orderNo,
        orderDate: detail.orderDate,
        customerName:
          detail.customerName ||
          customers.find((c: Customer) => c.id === detail.customerId)?.name ||
          '',
        customerPhone: customers.find((c: Customer) => c.id === detail.customerId)?.phone,
        items: (detail.items || []).map((it: DeliveryItem) => ({
          productName: it.productName,
          spec: it.spec,
          unit: it.unit,
          quantity: it.quantity,
          price: it.price,
          amount: it.amount,
        })),
        totalAmount: detail.totalAmount,
        remark: detail.remark,
      });
    } catch {
      toast.error('读取单据明细失败，无法打印');
    }
  };

  const columns: TableColumnsType<SalesDelivery> = [
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
      title: '打印',
      dataIndex: 'printStatus',
      width: 90,
      render: (v: string, record: SalesDelivery) =>
        v === 'printed' ? (
          <span className="text-green-600 text-xs">
            已打印{record.printCount ? `×${record.printCount}` : ''}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">未打印</span>
        ),
    },
    {
      title: '回单状态',
      dataIndex: 'receiptStatus',
      width: 100,
      render: (v: string) => {
        if (v === 'full') return <Badge variant="default">已结清</Badge>;
        if (v === 'partial') return <Badge variant="secondary">部分收款</Badge>;
        return <Badge variant="outline">未收款</Badge>;
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 320,
      render: (_: unknown, record: SalesDelivery) => (
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
            onClick={() => handlePrintRecord(record)}
            disabled={printing}
          >
            <Printer size={14} /> 打印
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

  const customerNameOf = (id: string): string =>
    customers.find((c: Customer) => c.id === id)?.name || '';

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> 新增送货单
          </Button>

        <div className="h-6 w-px bg-gray-200 mx-1" />

        <PinyinSelect
          value={searchCustomer}
          options={customerIdOptions}
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
          size={1}
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

      <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap bg-slate-50">
        <span className="text-xs text-gray-600">
          已勾选 <span className="font-semibold text-slate-900">{selectedRowKeys.length}</span> 张
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={batchBusy || selectedRowKeys.length === 0}
          onClick={() => void handleBatchPrint()}
        >
          {batchBusy ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          批量打印
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={batchBusy || selectedRowKeys.length === 0}
          onClick={() => void handleBatchAudit()}
        >
          <CheckCircle size={14} /> 批量审核
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={batchBusy || selectedRowKeys.length === 0}
          onClick={clearSelection}
        >
          清空选择
        </Button>
        {batchBusy && batchTotal > 0 && (
          <span className="text-xs text-blue-600">
            处理中 {batchDone} / {batchTotal}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">
          打印纸型：{paperPreset.label}
        </span>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 1200, y: 500 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys: React.Key[], rows: SalesDelivery[]) => {
            setSelectedRowKeys(keys);
            setSelectedRows(rows);
          },
          columnWidth: 40,
          preserveSelectedRowKeys: true,
        }}
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
                ? '查看送货单'
                : editId
                ? '编辑送货单'
                : '新增送货单'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <label className="w-16 text-gray-600">客户<span className="text-red-500">*</span></label>
              <PinyinAutoComplete
                value={customerInput}
                options={customerOptions}
                onChange={handleCustomerInputChange}
                onSelect={handleCustomerSelect}
                disabled={viewMode || formAudited}
                allowClear
                className="flex-1 min-w-0"
                placeholder="客户名/拼音首字母，↑↓选择，没有会自动建档"
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
              <span className="text-sm font-medium">商品明细</span>
              {!viewMode && (
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus size={14} /> 新增行
                </Button>
              )}
            </div>

            <div className="border border-gray-200 rounded text-sm">
              <div className="grid grid-cols-[1.8fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.6fr] bg-gray-50 font-semibold text-gray-700 text-xs">
                <div className="px-2 py-1.5 border-r border-gray-200">商品名称*</div>
                <div className="px-2 py-1.5 border-r border-gray-200">规格</div>
                <div className="px-2 py-1.5 border-r border-gray-200">单位</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">数量*</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">单价*</div>
                <div className="px-2 py-1.5 border-r border-gray-200 text-right">金额</div>
                <div className="px-2 py-1.5 text-center">操作</div>
              </div>
              {formItems.map((item: FormItem, idx: number) => (
                <div
                  key={item._key}
                  className="grid grid-cols-[1.8fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.6fr] border-t border-gray-200 items-center"
                >
                  <div className="px-1 py-1 border-r border-gray-200">
                    <PinyinAutoComplete
                      value={item.productName}
                      options={productOptions}
                      onChange={(v: string) =>
                        updateItem(item._key, { productName: v })
                      }
                      onSelect={(v: string, opt: ComboOption) => {
                        const picked = opt?.payload as Product | undefined;
                        if (picked) applyProduct(item._key, picked);
                        else handleProductChange(item._key, v);
                      }}
                      disabled={viewMode}
                      placeholder="商品名/拼音，↑↓选择"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="px-1 py-1 border-r border-gray-200">
                    <Input
                      value={item.spec || ''}
                      placeholder="规格"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item._key, {
                          spec: e.target.value,
                          productId: undefined,
                        })
                      }
                      onBlur={() =>
                        rebindBySpec(item._key, item.productName, item.spec || '')
                      }
                      className="h-7 text-xs"
                      readOnly={viewMode}
                    />
                  </div>
                  <div className="px-1 py-1 border-r border-gray-200">
                    <Input
                      value={item.unit || ''}
                      placeholder="单位"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateItem(item._key, {
                          unit: e.target.value,
                          productId: undefined,
                        })
                      }
                      onBlur={() =>
                        rebindBySpec(item._key, item.productName, item.spec || '')
                      }
                      className="h-7 text-xs"
                      readOnly={viewMode}
                    />
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
                  <div className="px-1 py-1 border-r border-gray-200 relative">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={String(item.price)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateItem(item._key, { price: Number(e.target.value) })
                        }
                        className="h-7 text-xs text-right flex-1"
                        readOnly={viewMode}
                        onFocus={() => {
                          if (
                            item.productName &&
                            formCustomer &&
                            activePriceRow !== item._key
                          ) {
                            loadPriceHistory(item._key, item.productName, formCustomer, false);
                          }
                        }}
                      />
                      {item.productName && formCustomer && (
                        <button
                          type="button"
                          className="text-gray-400 hover:text-blue-600 p-1"
                          title="查看历史价格"
                          onClick={() => {
                            if (activePriceRow === item._key) {
                              setActivePriceRow(null);
                            } else {
                              loadPriceHistory(
                                item._key,
                                item.productName,
                                formCustomer,
                                false
                              );
                            }
                          }}
                        >
                          <History size={14} />
                        </button>
                      )}
                    </div>
                    {activePriceRow === item._key && (
                      <div className="absolute z-10 top-full left-1 right-1 mt-1 bg-white border border-gray-200 rounded shadow-md text-xs">
                        <div className="px-2 py-1 bg-gray-50 font-medium text-gray-700 border-b">
                          {formCustomer
                            ? `近5次历史价格（${customerNameOf(formCustomer)}）`
                            : '近5次历史价格（请先选客户）'}
                        </div>
                        {priceHistoryLoading ? (
                          <div className="px-2 py-2 text-gray-400">加载中...</div>
                        ) : priceHistory.length === 0 ? (
                          <div className="px-2 py-2 text-gray-400">
                            {formCustomer ? '暂无历史价格' : '先选客户，可自动带出上次成交价'}
                          </div>
                        ) : (
                          <div className="max-h-40 overflow-y-auto">
                            {priceHistory.map((h: PriceHistory, i: number) => (
                              <div
                                key={i}
                                className="grid grid-cols-3 px-2 py-1 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                onClick={() => applyHistoryPrice(h.price)}
                              >
                                <span className="text-gray-600">{h.date}</span>
                                <span className="text-gray-600">{h.orderNo}</span>
                                <span className="text-right font-medium text-blue-700">
                                  ¥{h.price.toFixed(2)} × {h.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                    {idx === 0 && viewMode && <span className="text-gray-300">-</span>}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[1.8fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr_0.6fr] border-t border-gray-200 font-semibold bg-gray-50">
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

          <div className="mt-2 pt-2 border-t flex items-center gap-2 flex-wrap text-xs">
            <span className={printState.connected ? 'text-green-600' : 'text-red-500'}>
              {printState.connected ? '打印服务已连接' : '打印服务未连接'}
            </span>
            {!printState.connected && (
              <Button size="sm" variant="outline" onClick={launchPrintClient}>
                启动打印客户端
              </Button>
            )}
            <Select
              value={printerName || '_default'}
              onValueChange={(v: string) => setPrinterName(v === '_default' ? '' : v)}
            >
              <SelectTrigger size="sm" className="w-56 h-7 text-xs">
                <SelectValue placeholder="系统默认打印机" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_default">系统默认打印机</SelectItem>
                {printState.printers.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.displayName || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handlePrintForm} disabled={printing}>
              {printing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              打印送货单
            </Button>
            <span className="text-gray-400">纸张 {paperPreset.label}</span>
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
          {optionsLoading && <div className="text-xs text-gray-400">加载选项中...</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryPage;
