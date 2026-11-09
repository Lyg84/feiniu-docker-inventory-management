import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, type TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Printer, Search, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';

import { statementApi, customerApi } from '@client/src/api';
import type { CustomerStatement, Customer } from '@shared/api.interface';
import PinyinSelect from '@client/src/components/PinyinSelect';
import QuickRangeSelect from '@client/src/components/QuickRangeSelect';
import { quickRange } from '@/lib/quick-range';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildCustomerOptions } from '@/lib/entity-options';
import { pinyinMatchFields } from '@/lib/pinyin-match';
import { exportToExcel, todayStamp } from '@/lib/excel-export';

interface StatementRecord {
  date: string;
  type: 'delivery' | 'receipt' | 'return';
  no: string;
  salesAmount: number;
  receiptAmount: number;
  returnAmount: number;
  balance: number;
}

const StatementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [range, setRange] = useState<string>('month');
  const [startDate, setStartDate] = useState<string>(quickRange('month')[0]);
  const [endDate, setEndDate] = useState<string>(quickRange('month')[1]);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [customerFilter, setCustomerFilter] = useState<string>('');

  const customerOptions = useMemo<ComboOption[]>(
    () => buildCustomerOptions(customers),
    [customers]
  );

  /** 左侧客户列表按拼音/原文过滤，输入 xg 也能找到「硒鼓商行」这类客户 */
  const visibleCustomers = useMemo<Customer[]>(
    () =>
      customers.filter((c: Customer) =>
        pinyinMatchFields([c.name, c.contactPerson, c.phone], customerFilter)
      ),
    [customers, customerFilter]
  );

  useEffect(() => {
    customerApi
      .all()
      .then((custs: Customer[]) => {
        setCustomers(custs);
        if (custs.length > 0) {
          setSelectedCustomer(custs[0].id);
        }
      })
      .catch(() => toast.error('加载客户列表失败'));
  }, []);

  const loadStatement = useCallback((): void => {
    if (!selectedCustomer) {
      setStatement(null);
      return;
    }
    setLoading(true);
    statementApi
      .getCustomer({
        customerId: selectedCustomer,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      .then((res: CustomerStatement) => setStatement(res))
      .catch(() => {
        toast.error('加载对账单失败');
        setStatement(null);
      })
      .finally(() => setLoading(false));
  }, [selectedCustomer, startDate, endDate]);

  useEffect(() => {
    if (selectedCustomer) {
      loadStatement();
    }
  }, [loadStatement, selectedCustomer]);

  /** 选快捷时间后自动回填起止日期 */
  const handleRangeChange = (key: string): void => {
    if (!key) return;
    const [start, end] = quickRange(key);
    setRange(key);
    setStartDate(start);
    setEndDate(end);
  };

  const handlePrint = (): void => {
    window.print();
  };

  /** 把当前对账单导出成 Excel */
  const handleExport = (): void => {
    if (!statement) {
      toast.error('请先选择客户并对账单加载完成');
      return;
    }
    const rows: StatementRecord[] = statement.records ?? [];
    if (rows.length === 0) {
      toast.error('当前条件没有对账明细');
      return;
    }
    const typeText = (v: string): string => {
      if (v === 'delivery') return '销售送货';
      if (v === 'receipt') return '收款';
      return '销售退货';
    };
    exportToExcel<StatementRecord>({
      fileName: `客户对账单_${statement.customerName || ''}_${todayStamp()}`,
      sheetName: '对账单',
      rows,
      columns: [
        { header: '日期', value: (r: StatementRecord) => r.date, width: 12 },
        { header: '单据类型', value: (r: StatementRecord) => typeText(r.type), width: 12 },
        { header: '单号', value: (r: StatementRecord) => r.no, width: 18 },
        { header: '销售额', value: (r: StatementRecord) => r.salesAmount, numeric: true, width: 12 },
        { header: '收款额', value: (r: StatementRecord) => r.receiptAmount, numeric: true, width: 12 },
        { header: '退货额', value: (r: StatementRecord) => r.returnAmount, numeric: true, width: 12 },
        { header: '余额', value: (r: StatementRecord) => r.balance, numeric: true, width: 12 },
      ],
      note: `客户：${statement.customerName || '-'}  期间：${startDate || '全部'} ~ ${endDate || '全部'}  本期收款 ¥${(statement.totalReceipt ?? 0).toFixed(2)}  期末欠款 ¥${(statement.debtAmount ?? 0).toFixed(2)}  导出时间：${new Date().toLocaleString('zh-CN')}`,
    });
    toast.success('已导出 Excel');
  };

  const columns: TableColumnsType<StatementRecord> = [
    { title: '日期', dataIndex: 'date', width: 120 },
    {
      title: '单据类型',
      dataIndex: 'type',
      width: 100,
      render: (v: string) => {
        if (v === 'delivery') return <Badge variant="default">销售送货</Badge>;
        if (v === 'receipt') return <Badge variant="secondary">收款</Badge>;
        return <Badge variant="destructive">销售退货</Badge>;
      },
    },
    { title: '单号', dataIndex: 'no', width: 160 },
    {
      title: '销售额',
      dataIndex: 'salesAmount',
      width: 120,
      align: 'right',
      render: (v: number) => (v > 0 ? v.toFixed(2) : '-'),
    },
    {
      title: '收款额',
      dataIndex: 'receiptAmount',
      width: 120,
      align: 'right',
      render: (v: number) => (v > 0 ? v.toFixed(2) : '-'),
    },
    {
      title: '退货额',
      dataIndex: 'returnAmount',
      width: 120,
      align: 'right',
      render: (v: number) => (v > 0 ? v.toFixed(2) : '-'),
    },
    {
      title: '余额',
      dataIndex: 'balance',
      width: 120,
      align: 'right',
      fixed: 'right',
      render: (v: number) => (
        <span className={v > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
          {v.toFixed(2)}
        </span>
      ),
    },
  ];

  const openingDebt = statement
    ? statement.debtAmount -
      statement.totalSales +
      statement.totalReceipt +
      statement.totalReturn
    : 0;

  const pendingParts: string[] = [];
  if (statement) {
    const d = statement.pendingDeliveryCount ?? 0;
    const r = statement.pendingReturnCount ?? 0;
    const p = statement.pendingReceiptCount ?? 0;
    if (d > 0) pendingParts.push(`${d} 张送货单 ¥${(statement.pendingDeliveryAmount ?? 0).toFixed(2)}`);
    if (r > 0) pendingParts.push(`${r} 张退货单 ¥${(statement.pendingReturnAmount ?? 0).toFixed(2)}`);
    if (p > 0) pendingParts.push(`${p} 张收款单 ¥${(statement.pendingReceiptAmount ?? 0).toFixed(2)}`);
  }
  const pendingText = pendingParts.join('、');

  return (
    <div className="flex gap-3 h-full print:block">
      {/* 左侧客户列表 */}
      <div className="w-56 bg-white rounded border border-gray-200 flex-shrink-0 flex flex-col print:hidden">
        <div className="p-2 border-b text-sm font-medium text-gray-700">
          客户列表
        </div>
        <div className="p-2 border-b">
          <Input
            value={customerFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCustomerFilter(e.target.value)
            }
            placeholder="拼音/名称/电话"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1 overflow-y-auto text-sm">
          {visibleCustomers.map((c: Customer) => (
            <div
              key={c.id}
              onClick={() => setSelectedCustomer(c.id)}
              className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${
                selectedCustomer === c.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              <div className="truncate">{c.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                欠款: ¥{c.debtAmount?.toFixed(2) || '0.00'}
              </div>
            </div>
          ))}
          {visibleCustomers.length === 0 && (
            <div className="p-4 text-center text-gray-400 text-xs">暂无客户</div>
          )}
        </div>
      </div>

      {/* 右侧对账单 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col min-w-0">
        <div className="p-3 border-b flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 print:hidden">
            <FileText size={16} className="text-blue-700" />
            <span className="font-medium text-gray-800">客户对账单</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 print:hidden">
            <PinyinSelect
              value={selectedCustomer}
              options={customerOptions}
              onChange={setSelectedCustomer}
              placeholder="选择客户"
              allowClear={false}
              className="w-44"
            />

            <QuickRangeSelect value={range} onChange={handleRangeChange} />

            <Input
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStartDate(e.target.value);
                setRange('');
              }}
              type="date"
              className="w-36 h-8 text-xs"
              placeholder="开始日期"
            />
            <span className="text-gray-400">至</span>
            <Input
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setEndDate(e.target.value);
                setRange('');
              }}
              type="date"
              className="w-36 h-8 text-xs"
              placeholder="结束日期"
            />

            <Button size="sm" variant="default" onClick={loadStatement}>
              <Search size={14} /> 查询
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="print:hidden"
          >
            <Printer size={14} /> 打印
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="print:hidden"
          >
            <Download size={14} /> 导出 Excel
          </Button>
        </div>

        {/* 汇总区 */}
        <div className="p-3 border-b bg-gray-50">
          <div className="text-sm font-medium text-gray-800 mb-2">
            {statement?.customerName || '请选择客户'}
          </div>
          <div className="grid grid-cols-5 gap-3 text-xs">
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="text-gray-500">期初欠款</div>
              <div className="text-base font-semibold text-red-600 mt-1">
                ¥{openingDebt.toFixed(2)}
              </div>
            </div>
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="text-gray-500">本期货款</div>
              <div className="text-base font-semibold text-blue-700 mt-1">
                ¥{statement?.totalSales?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="text-gray-500">本期收款</div>
              <div className="text-base font-semibold text-green-700 mt-1">
                ¥{statement?.totalReceipt?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="text-gray-500">本期退货</div>
              <div className="text-base font-semibold text-orange-600 mt-1">
                ¥{statement?.totalReturn?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="text-gray-500">期末欠款</div>
              <div className="text-base font-semibold text-red-600 mt-1">
                ¥{statement?.debtAmount?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
          {pendingText ? (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              另有 {pendingText} 未审核（草稿），审核后才计入往来账，故未显示在上表。
            </div>
          ) : null}
        </div>

        {/* 明细表格 */}
        <div className="flex-1 min-h-0">
          <Table
            columns={columns}
            dataSource={statement?.records || []}
            rowKey={(_, index: number | undefined) => `row-${index}`}
            loading={loading}
            size="small"
            scroll={{ x: 800, y: 400 }}
            pagination={false}
            summary={() => (
              <Table.Summary.Row className="bg-gray-50 font-semibold">
                <Table.Summary.Cell index={0} colSpan={3}>
                  合计
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  ¥{statement?.totalSales?.toFixed(2) || '0.00'}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  ¥{statement?.totalReceipt?.toFixed(2) || '0.00'}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  ¥{statement?.totalReturn?.toFixed(2) || '0.00'}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  期末: ¥{statement?.debtAmount?.toFixed(2) || '0.00'}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default StatementPage;
