import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Plus, Pencil, Trash2, Search, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { financeExpenseApi, financeItemApi } from '@client/src/api';
import type { FinanceExpense, FinanceItem } from '@shared/api.interface';
import PinyinSelect from '@client/src/components/PinyinSelect';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildFinanceItemOptions } from '@/lib/entity-options';
import { showConfirm } from '@lark-apaas/client-toolkit';
import { exportToExcel, fetchAllPages, todayStamp } from '@/lib/excel-export';

const todayStr = new Date().toISOString().split('T')[0];

const defaultForm: Partial<FinanceExpense> = {
  expenseDate: todayStr,
  itemId: '',
  itemName: '',
  amount: 0,
  payee: '',
  remark: '',
};

export default function FinanceExpensePage() {
  const [list, setList] = useState<FinanceExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<FinanceExpense>>(defaultForm);
  const [itemList, setItemList] = useState<FinanceItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const itemOptions = useMemo<ComboOption[]>(
    () => buildFinanceItemOptions(itemList),
    [itemList]
  );

  const fetchItems = useCallback(async () => {
    try {
      const items = await financeItemApi.list({ type: 'expense' });
      setItemList(items);
    } catch {
      toast.error('加载收支项目失败');
    }
  }, []);

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      const res = await financeExpenseApi.list({ page: p, pageSize, keyword: kw });
      setList(res.items);
      setTotal(res.total);
      setPage(res.page);
      const sum = res.items.reduce((acc: number, item: FinanceExpense) => acc + (item.amount || 0), 0);
      setTotalAmount(sum);
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchKw]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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
    setForm({ ...defaultForm, expenseDate: todayStr });
    setDialogOpen(true);
  };

  const handleEdit = (record: FinanceExpense) => {
    setEditingId(record.id);
    setForm({ ...record });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该支出单吗？')) return;
    try {
      await financeExpenseApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.itemId) {
      toast.error('请选择收支项目');
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    try {
      const selected = itemList.find((it: FinanceItem) => it.id === form.itemId);
      const payload: Partial<FinanceExpense> = {
        ...form,
        itemName: selected?.name || form.itemName,
        amount: Number(form.amount),
      };
      if (editingId) {
        await financeExpenseApi.update(editingId, payload);
        toast.success('修改成功');
      } else {
        await financeExpenseApi.create(payload);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  /** 导出当前查询条件下的全部支出单（不只是当前页） */
  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await fetchAllPages<FinanceExpense>((p, ps) =>
        financeExpenseApi.list({ page: p, pageSize: ps, keyword: searchKw }),
      );
      if (rows.length === 0) {
        toast.error('当前条件下没有可导出的支出单');
        return;
      }
      exportToExcel<FinanceExpense>({
        fileName: `财务支出单_${todayStamp()}`,
        sheetName: '支出单',
        rows,
        columns: [
          { header: '支出单号', value: (r: FinanceExpense) => r.expenseNo, width: 18 },
          { header: '日期', value: (r: FinanceExpense) => r.expenseDate, width: 12 },
          { header: '收支项目', value: (r: FinanceExpense) => r.itemName ?? '', width: 16 },
          { header: '金额', value: (r: FinanceExpense) => r.amount, numeric: true, width: 12 },
          { header: '收款方', value: (r: FinanceExpense) => r.payee ?? '', width: 18 },
          { header: '备注', value: (r: FinanceExpense) => r.remark ?? '', width: 24 },
        ],
        note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
      });
      toast.success('已导出 Excel');
    } catch {
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const columns: TableColumnsType<FinanceExpense> = [
    { title: '支出单号', dataIndex: 'expenseNo', width: 180, fixed: 'left' },
    { title: '日期', dataIndex: 'expenseDate', width: 120 },
    { title: '收支项目', dataIndex: 'itemName', width: 150 },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <span className="text-red-600 font-medium">{v?.toFixed(2)}</span>
      ),
    },
    { title: '收款方', dataIndex: 'payee', width: 150 },
    { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: FinanceExpense) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(record)}
            className="h-7 px-2"
          >
            <Pencil className="w-3 h-3" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(record.id)}
            className="h-7 px-2 text-red-600 hover:text-red-700"
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
        <div className="text-base font-semibold text-gray-800">财务支出单</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按单号/收款方搜索"
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
          <Button size="sm" variant="outline" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="w-3 h-3" />
            {exporting ? '导出中…' : '导出 Excel'}
          </Button>
          <Button size="sm" variant="default" onClick={handleAdd}>
            <Plus className="w-3 h-3" />
            新增
          </Button>
        </div>
      </div>
      <Table<FinanceExpense>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000, y: 500 }}
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
      <div className="px-4 py-2 border-t border-gray-200 text-sm text-right text-gray-700">
        本页支出合计：<span className="text-red-600 font-semibold">¥ {totalAmount.toFixed(2)}</span>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑支出单' : '新增支出单'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>日期</Label>
              <Input
                type="date"
                value={form.expenseDate || ''}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>
                收支项目 <span className="text-red-500">*</span>
              </Label>
              <PinyinSelect
                value={form.itemId || ''}
                options={itemOptions}
                onChange={(val: string) => {
                  const selected = itemList.find((it: FinanceItem) => it.id === val);
                  setForm({ ...form, itemId: val, itemName: selected?.name });
                }}
                placeholder="请选择"
                className="w-full h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>
                金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="h-8 text-right"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>收款方</Label>
              <Input
                value={form.payee || ''}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>备注</Label>
              <Textarea
                value={form.remark || ''}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
