import React, { useEffect } from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import LoginPage from './pages/LoginPage/LoginPage';
import DeliveryPage from './pages/sales/DeliveryPage';
import SalesReturnPage from './pages/sales/SalesReturnPage';
import ReceiptPage from './pages/sales/ReceiptPage';
import StatementPage from './pages/sales/StatementPage';
import SalesSearchPage from './pages/sales/SalesSearchPage';

import PurchaseInPage from './pages/purchase/PurchaseInPage';
import PurchaseReturnPage from './pages/purchase/PurchaseReturnPage';
import PaymentPage from './pages/purchase/PaymentPage';
import PurchaseSearchPage from './pages/purchase/PurchaseSearchPage';

import StockInPage from './pages/stock/StockInPage';
import StockOutPage from './pages/stock/StockOutPage';
import MaterialRequisitionPage from './pages/stock/MaterialRequisitionPage';
import MaterialReturnPage from './pages/stock/MaterialReturnPage';
import InventoryPage from './pages/stock/InventoryPage';

import FinanceIncomePage from './pages/finance/FinanceIncomePage';
import FinanceExpensePage from './pages/finance/FinanceExpensePage';
import FinanceItemPage from './pages/finance/FinanceItemPage';

import ProductPage from './pages/basic/ProductPage';
import CustomerPage from './pages/basic/CustomerPage';
import SupplierPage from './pages/basic/SupplierPage';
import EmployeePage from './pages/basic/EmployeePage';
import WarehousePage from './pages/basic/WarehousePage';

import SysUserPage from './pages/system/SysUserPage';
import SysLogPage from './pages/system/SysLogPage';
import SysParamPage from './pages/system/SysParamPage';
import PasswordPage from './pages/system/PasswordPage';
import SystemBackupPage from './pages/system/SystemBackupPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const user = localStorage.getItem('erp_user');
    if (!user) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
    }
  }, [navigate, location.pathname]);
  const user = localStorage.getItem('erp_user');
  if (!user) return null;
  return <>{children}</>;
};

const RoutesComponent = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DeliveryPage />} />
        <Route path="sales/delivery" element={<DeliveryPage />} />
        <Route path="sales/return" element={<SalesReturnPage />} />
        <Route path="sales/receipt" element={<ReceiptPage />} />
        <Route path="sales/statement" element={<StatementPage />} />
        <Route path="sales/search" element={<SalesSearchPage />} />

        <Route path="purchase/in" element={<PurchaseInPage />} />
        <Route path="purchase/return" element={<PurchaseReturnPage />} />
        <Route path="purchase/payment" element={<PaymentPage />} />
        <Route path="purchase/search" element={<PurchaseSearchPage />} />

        <Route path="stock/in" element={<StockInPage />} />
        <Route path="stock/out" element={<StockOutPage />} />
        <Route path="stock/requisition" element={<MaterialRequisitionPage />} />
        <Route path="stock/return" element={<MaterialReturnPage />} />
        <Route path="stock/inventory" element={<InventoryPage />} />

        <Route path="finance/income" element={<FinanceIncomePage />} />
        <Route path="finance/expense" element={<FinanceExpensePage />} />
        <Route path="finance/item" element={<FinanceItemPage />} />

        <Route path="basic/product" element={<ProductPage />} />
        <Route path="basic/customer" element={<CustomerPage />} />
        <Route path="basic/supplier" element={<SupplierPage />} />
        <Route path="basic/employee" element={<EmployeePage />} />
        <Route path="basic/warehouse" element={<WarehousePage />} />

        <Route path="system/user" element={<SysUserPage />} />
        <Route path="system/log" element={<SysLogPage />} />
        <Route path="system/param" element={<SysParamPage />} />
        <Route path="system/backup" element={<SystemBackupPage />} />
        <Route path="system/password" element={<PasswordPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
