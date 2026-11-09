import { useState } from 'react';
import { toast } from 'sonner';
import { Lock, KeyRound } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { systemApi } from '@client/src/api';

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const defaultForm: PasswordForm = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function PasswordPage() {
  const [form, setForm] = useState<PasswordForm>(defaultForm);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.oldPassword) {
      toast.error('请输入原密码');
      return;
    }
    if (!form.newPassword) {
      toast.error('请输入新密码');
      return;
    }
    if (form.newPassword.length < 6) {
      toast.error('新密码长度不能少于6位');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await systemApi.changePassword({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
      if (res.success) {
        toast.success('密码修改成功');
        setForm(defaultForm);
      } else {
        toast.error(res.message || '密码修改失败');
      }
    } catch {
      toast.error('密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-700" />
            修改密码
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>
              原密码 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="password"
                value={form.oldPassword}
                onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                className="h-9 pl-9"
                placeholder="请输入原密码"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>
              新密码 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                className="h-9 pl-9"
                placeholder="请输入新密码（不少于6位）"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>
              确认密码 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="h-9 pl-9"
                placeholder="请再次输入新密码"
              />
            </div>
          </div>
          <Button
            className="w-full h-9"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '修改中...' : '确认修改'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
