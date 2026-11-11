import { useState, useEffect, useCallback } from 'react';
import { Table, TableColumnsType } from 'antd';
import { Plus, Pencil, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
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
import { systemApi } from '@client/src/api';
import type { SysUser } from '@shared/api.interface';
import { showConfirm } from '@/lib/confirm';

interface UserForm extends Partial<SysUser> {
  password?: string;
}

const defaultForm: UserForm = {
  username: '',
  password: '',
  name: '',
  role: 'user',
  status: 'active',
};

const roleMap: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
};

export default function SysUserPage() {
  const [list, setList] = useState<SysUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(defaultForm);

  const fetchData = useCallback(async (p = page, kw = searchKw) => {
    setLoading(true);
    try {
      const res = await systemApi.userList({ page: p, pageSize, keyword: kw });
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

  const handleEdit = (record: SysUser) => {
    setEditingId(record.id);
    setForm({ ...record, password: '' });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定删除该用户吗？')) return;
    try {
      await systemApi.userRemove(id);
      toast.success('删除成功');
      fetchData(page, searchKw);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.username?.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (!editingId && !form.password) {
      toast.error('请输入密码');
      return;
    }
    try {
      if (editingId) {
        const data: Partial<SysUser> = { ...form };
        if (!form.password) delete (data as UserForm).password;
        await systemApi.userUpdate(editingId, data);
        toast.success('修改成功');
      } else {
        await systemApi.userCreate(form as Partial<SysUser> & { password: string });
        toast.success('新增成功');
      }
      setDialogOpen(false);
      fetchData(page, searchKw);
    } catch {
      toast.error('保存失败');
    }
  };

  const columns: TableColumnsType<SysUser> = [
    { title: '用户名', dataIndex: 'username', width: 150, fixed: 'left' },
    { title: '姓名', dataIndex: 'name', width: 120 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 100,
      render: (v: string) => roleMap[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => (
        <Badge variant={v === 'active' ? 'default' : 'secondary'}>
          {v === 'active' ? '启用' : '禁用'}
        </Badge>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_: unknown, record: SysUser) => (
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
        <div className="text-base font-semibold text-gray-800">系统用户设置</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按用户名搜索"
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
      <Table<SysUser>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800, y: 500 }}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑用户' : '新增用户'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>
                  用户名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.username || ''}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  {editingId ? '密码' : (
                    <>密码 <span className="text-red-500">*</span></>
                  )}
                </Label>
                <Input
                  type="password"
                  value={form.password || ''}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingId ? '不修改请留空' : ''}
                  className="h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>姓名</Label>
                <Input
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label>角色</Label>
                <Select
                  value={form.role || 'user'}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger size="sm" className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="user">普通用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>状态</Label>
              <Select
                value={form.status || 'active'}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger size="sm" className="w-full h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="disabled">禁用</SelectItem>
                </SelectContent>
              </Select>
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
