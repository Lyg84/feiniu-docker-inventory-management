import { useState, useEffect, useCallback } from 'react';
import { Table, TableColumnsType } from 'antd';
import { Plus, Pencil, Trash2, Search, RefreshCw, Upload } from 'lucide-react';
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
import { customerApi } from '@client/src/api';
import type { Customer } from '@shared/api.interface';
import ExcelImportDialog, {
  type ImportColumn,
} from '@client/src/components/ExcelImportDialog';

const CUSTOMER_IMPORT_COLUMNS: ImportColumn[] = [
  {
    header: '客户名称',
    aliases: ['客户', '名称'],
    field: 'name',
    required: true,
    sample: '张三商行',
  },
  {
    header: '联系人',
    aliases: ['联系人姓名'],
    field: 'contactPerson',
    sample: '张三',
  },
  {
    header: '电话',
    aliases: ['联系电话', '手机', '手机号'],
    field: 'phone',
    sample: '13800000000',
  },
  {
    header: '地址',
    aliases: ['客户地址', '联系地址'],
    field: 'address',
    sample: '辽宁省鞍山市铁西区',
  },
  { header: '备注', field: 'remark', sample: '月结30天' },
];
import { showConfirm } from '@/lib/confirm';

const defaultForm: Partial<Customer> = {
  name: '',
  contactPerson: '',
  phone: '',
  address: '',
  remark: '',
};

export default function CustomerPage() {
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(defaultForm);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      const res = await customerApi.list({ page: p, pageSize, keyword: kw });
      setList(res.items);
      setTotal(res.total);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  }, [pageSize, searchKw]);

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
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const handleEdit = (record: Customer) => {
    setEditingId(record.id);
    setForm({ ...record });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该客户资料吗？')) return;
    try {
      await customerApi.remove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      toast.error('请输入客户名称');
      return;
    }
    try {
      if (editingId) {
        await customerApi.update(editingId, form);
        toast.success('修改成功');
      } else {
        await customerApi.create(form);
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<Customer> = [
    { title: '客户名称', dataIndex: 'name', width: 180, fixed: 'left' },
    { title: '联系人', dataIndex: 'contactPerson', width: 100 },
    { title: '电话', dataIndex: 'phone', width: 130 },
    { title: '地址', dataIndex: 'address', width: 200, ellipsis: true },
    {
      title: '累计货款',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '已收款',
      dataIndex: 'paidAmount',
      width: 110,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '欠款',
      dataIndex: 'debtAmount',
      width: 110,
      align: 'right',
      render: (v: number) => (
        <span className={v > 0 ? 'text-red-600' : ''}>{v?.toFixed(2)}</span>
      ),
    },
    { title: '备注', dataIndex: 'remark', width: 180, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: Customer) => (
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
        <div className="text-base font-semibold text-gray-800">客户资料</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按名称搜索"
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-3 h-3" />
            导入 Excel
          </Button>
          <Button size="sm" variant="default" onClick={handleAdd}>
            <Plus className="w-3 h-3" />
            新增
          </Button>
        </div>
      </div>
      <Table<Customer>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200, y: 500 }}
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑客户' : '新增客户'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                客户名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>联系人</Label>
              <Input
                value={form.contactPerson || ''}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>电话</Label>
              <Input
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label>地址</Label>
              <Input
                value={form.address || ''}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
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
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入客户资料"
        templateName="客户导入模板.xlsx"
        columns={CUSTOMER_IMPORT_COLUMNS}
        onImport={(rows) => customerApi.import(rows)}
        onDone={() => fetchData(1, searchKw)}
      />
    </div>
  );
}
