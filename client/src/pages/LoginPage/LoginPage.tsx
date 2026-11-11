import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import { logger } from '@/lib/logger';
import { systemApi } from '@client/src/api';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await systemApi.login({ username, password });
      if (result.success) {
        localStorage.setItem('erp_user', JSON.stringify(result.user));
        navigate('/sales/delivery');
      } else {
        setError(result.message || '登录失败');
      }
    } catch (err) {
      logger.error('login error', err);
      setError('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-96 overflow-hidden">
        <div className="bg-slate-800 text-white py-6 px-6 text-center">
          <h1 className="text-xl font-bold">进销存管理系统</h1>
          <p className="text-slate-300 text-sm mt-1">Inventory Management System</p>
        </div>
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">用户名</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-sm"
                placeholder="请输入用户名"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-sm"
                placeholder="请输入密码"
              />
            </div>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            <LogIn size={16} />
            {loading ? '登录中...' : '登 录'}
          </button>
          <div className="text-xs text-gray-400 text-center pt-2">
            默认账号: admin / admin123
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
