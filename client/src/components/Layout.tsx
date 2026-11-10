import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Package, Warehouse, DollarSign, Database, Settings,
  ChevronDown, ChevronRight, LogOut, User
} from 'lucide-react';

interface MenuItem {
  key: string;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

const menuGroups: MenuItem[] = [
  {
    key: 'sales',
    label: '销售管理',
    icon: <ShoppingCart size={16} />,
    children: [
      { key: 'delivery', label: '开送货单', path: '/sales/delivery' },
      { key: 'sales-return', label: '销售退货单', path: '/sales/return' },
      { key: 'receipt', label: '销售收款单', path: '/sales/receipt' },
      { key: 'statement', label: '客户对账单', path: '/sales/statement' },
      { key: 'sales-search', label: '销售单据查找', path: '/sales/search' },
    ],
  },
  {
    key: 'purchase',
    label: '采购管理',
    icon: <Package size={16} />,
    children: [
      { key: 'purchase-in', label: '采购进库', path: '/purchase/in' },
      { key: 'purchase-return', label: '采购退货', path: '/purchase/return' },
      { key: 'payment', label: '采购付款单', path: '/purchase/payment' },
      { key: 'purchase-search', label: '采购单据查找', path: '/purchase/search' },
    ],
  },
  {
    key: 'stock',
    label: '仓库管理',
    icon: <Warehouse size={16} />,
    children: [
      { key: 'stock-in', label: '产品进库单', path: '/stock/in' },
      { key: 'stock-out', label: '产品出库单', path: '/stock/out' },
      { key: 'material-req', label: '材料领用单', path: '/stock/requisition' },
      { key: 'material-return', label: '材料退仓单', path: '/stock/return' },
      { key: 'inventory', label: '存货查询', path: '/stock/inventory' },
    ],
  },
  {
    key: 'finance',
    label: '财务管理',
    icon: <DollarSign size={16} />,
    children: [
      { key: 'finance-income', label: '财务收入单', path: '/finance/income' },
      { key: 'finance-expense', label: '财务支出单', path: '/finance/expense' },
      { key: 'finance-item', label: '收支项目管理', path: '/finance/item' },
    ],
  },
  {
    key: 'basic',
    label: '基础资料',
    icon: <Database size={16} />,
    children: [
      { key: 'product', label: '产品资料', path: '/basic/product' },
      { key: 'customer', label: '客户资料', path: '/basic/customer' },
      { key: 'supplier', label: '供应商资料', path: '/basic/supplier' },
      { key: 'employee', label: '职员资料', path: '/basic/employee' },
      { key: 'warehouse', label: '仓库资料', path: '/basic/warehouse' },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: <Settings size={16} />,
    children: [
      { key: 'sys-user', label: '系统用户设置', path: '/system/user' },
      { key: 'sys-log', label: '操作日志管理', path: '/system/log' },
      { key: 'sys-param', label: '系统参数设置', path: '/system/param' },
      { key: 'sys-backup', label: '备份还原', path: '/system/backup' },
      { key: 'sys-password', label: '修改密码', path: '/system/password' },
    ],
  },
];

const Layout: React.FC = () => {
  const [openKeys, setOpenKeys] = useState<string[]>(['sales', 'basic']);
  const navigate = useNavigate();

  const toggleGroup = (key: string) => {
    setOpenKeys((prev: string[]) =>
      prev.includes(key) ? prev.filter((k: string) => k !== key) : [...prev, key]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('erp_user');
    navigate('/login');
  };

  const userStr = localStorage.getItem('erp_user');
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
      <aside className="w-56 bg-slate-800 text-white flex flex-col flex-shrink-0">
        <div className="h-12 flex items-center justify-center bg-slate-900 text-base font-bold border-b border-slate-700">
          进销存管理系统
        </div>
        <nav className="flex-1 overflow-y-auto py-1 text-sm">
          {menuGroups.map((group) => (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left"
              >
                {group.icon}
                <span className="flex-1">{group.label}</span>
                {openKeys.includes(group.key) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
              {openKeys.includes(group.key) && group.children && (
                <div className="bg-slate-900/50">
                  {group.children.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.path || '#'}
                      className={({ isActive }) =>
                        `block pl-8 pr-3 py-1.5 text-sm ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
          <div className="text-sm text-gray-600">欢迎使用进销存管理系统</div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <User size={14} />
              <span>{user?.name || user?.username || '管理员'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-600 hover:text-red-600"
            >
              <LogOut size={14} />
              退出
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
