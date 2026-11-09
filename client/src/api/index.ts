import { logger } from '@/lib/logger';
import { axiosForBackend } from '@/lib/http';
import { buildQuery } from '@/lib/query';
import type { PageResult, Customer, Product, Supplier, Employee, Warehouse, FinanceItem,
  SalesDelivery, SalesReturn, Receipt, PurchaseIn, PurchaseReturn, Payment,
  StockIn, StockOut, MaterialRequisition, MaterialReturn,
  FinanceIncome, FinanceExpense, CustomerStatement, SysUser, SysLog, SysParam, PriceHistory } from '@shared/api.interface';

async function request<T>(url: string, method: string = 'GET', data?: unknown): Promise<T> {
  try {
    const res = await axiosForBackend({ url, method, data });
    return res.data as T;
  } catch (error) {
    logger.error(`API error: ${url}`, error);
    throw error;
  }
}

export interface ImportSummary {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; name?: string; reason: string }>;
}

export const customerApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<Customer>>(`/api/customers?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  all: () => request<Customer[]>('/api/customers/all'),
  get: (id: string) => request<Customer>(`/api/customers/${id}`),
  create: (data: Partial<Customer>) => request<Customer>('/api/customers', 'POST', data),
  update: (id: string, data: Partial<Customer>) => request<Customer>(`/api/customers/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/customers/${id}`, 'DELETE'),
  import: (rows: Array<Record<string, unknown>>) =>
    request<ImportSummary>('/api/customers/import', 'POST', { rows }),
  export: (params: Record<string, unknown>) =>
    request<string>(`/api/customers/export?${buildQuery(params)}`),
};

export const productApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<Product>>(`/api/products?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  all: () => request<Product[]>('/api/products/all'),
  get: (id: string) => request<Product>(`/api/products/${id}`),
  create: (data: Partial<Product>) => request<Product>('/api/products', 'POST', data),
  update: (id: string, data: Partial<Product>) => request<Product>(`/api/products/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/products/${id}`, 'DELETE'),
  import: (rows: Array<Record<string, unknown>>) =>
    request<ImportSummary>('/api/products/import', 'POST', { rows }),
  priceHistory: (productName: string, customerId: string) =>
    request<PriceHistory[]>(`/api/products/price-history?productName=${encodeURIComponent(productName)}&customerId=${customerId}`),
};

export const supplierApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<Supplier>>(`/api/suppliers?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  all: () => request<Supplier[]>('/api/suppliers/all'),
  get: (id: string) => request<Supplier>(`/api/suppliers/${id}`),
  create: (data: Partial<Supplier>) => request<Supplier>('/api/suppliers', 'POST', data),
  update: (id: string, data: Partial<Supplier>) => request<Supplier>(`/api/suppliers/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/suppliers/${id}`, 'DELETE'),
};

export const employeeApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<Employee>>(`/api/employees?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  all: () => request<Employee[]>('/api/employees/all'),
  create: (data: Partial<Employee>) => request<Employee>('/api/employees', 'POST', data),
  update: (id: string, data: Partial<Employee>) => request<Employee>(`/api/employees/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/employees/${id}`, 'DELETE'),
};

export const warehouseApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<Warehouse>>(`/api/warehouses?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  all: () => request<Warehouse[]>('/api/warehouses/all'),
  create: (data: Partial<Warehouse>) => request<Warehouse>('/api/warehouses', 'POST', data),
  update: (id: string, data: Partial<Warehouse>) => request<Warehouse>(`/api/warehouses/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/warehouses/${id}`, 'DELETE'),
};

export const salesDeliveryApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<SalesDelivery>>(`/api/sales-deliveries?${qs}`);
  },
  get: (id: string) => request<SalesDelivery>(`/api/sales-deliveries/${id}`),
  create: (data: Partial<SalesDelivery>) => request<SalesDelivery>('/api/sales-deliveries', 'POST', data),
  update: (id: string, data: Partial<SalesDelivery>) => request<SalesDelivery>(`/api/sales-deliveries/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/sales-deliveries/${id}`, 'DELETE'),
  audit: (id: string) => request<SalesDelivery>(`/api/sales-deliveries/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<SalesDelivery>(`/api/sales-deliveries/${id}/unaudit`, 'POST'),
  markReturn: (ids: string[]) => request<void>('/api/sales-deliveries/batch-mark-return', 'POST', { ids }),
  markPrinted: (id: string) => request<SalesDelivery>(`/api/sales-deliveries/${id}/print-mark`, 'POST'),
};

export const salesReturnApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<SalesReturn>>(`/api/sales-returns?${qs}`);
  },
  get: (id: string) => request<SalesReturn>(`/api/sales-returns/${id}`),
  create: (data: Partial<SalesReturn>) => request<SalesReturn>('/api/sales-returns', 'POST', data),
  update: (id: string, data: Partial<SalesReturn>) => request<SalesReturn>(`/api/sales-returns/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/sales-returns/${id}`, 'DELETE'),
  audit: (id: string) => request<SalesReturn>(`/api/sales-returns/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<SalesReturn>(`/api/sales-returns/${id}/unaudit`, 'POST'),
};

export const receiptApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<Receipt>>(`/api/receipts?${qs}`);
  },
  get: (id: string) => request<Receipt>(`/api/receipts/${id}`),
  create: (data: Partial<Receipt>) => request<Receipt>('/api/receipts', 'POST', data),
  update: (id: string, data: Partial<Receipt>) => request<Receipt>(`/api/receipts/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/receipts/${id}`, 'DELETE'),
  audit: (id: string) => request<Receipt>(`/api/receipts/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<Receipt>(`/api/receipts/${id}/unaudit`, 'POST'),
};

export const purchaseInApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<PurchaseIn>>(`/api/purchase-ins?${qs}`);
  },
  get: (id: string) => request<PurchaseIn>(`/api/purchase-ins/${id}`),
  create: (data: Partial<PurchaseIn>) => request<PurchaseIn>('/api/purchase-ins', 'POST', data),
  update: (id: string, data: Partial<PurchaseIn>) => request<PurchaseIn>(`/api/purchase-ins/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/purchase-ins/${id}`, 'DELETE'),
  audit: (id: string) => request<PurchaseIn>(`/api/purchase-ins/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<PurchaseIn>(`/api/purchase-ins/${id}/unaudit`, 'POST'),
};

export const purchaseReturnApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<PurchaseReturn>>(`/api/purchase-returns?${qs}`);
  },
  get: (id: string) => request<PurchaseReturn>(`/api/purchase-returns/${id}`),
  create: (data: Partial<PurchaseReturn>) => request<PurchaseReturn>('/api/purchase-returns', 'POST', data),
  update: (id: string, data: Partial<PurchaseReturn>) => request<PurchaseReturn>(`/api/purchase-returns/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/purchase-returns/${id}`, 'DELETE'),
  audit: (id: string) => request<PurchaseReturn>(`/api/purchase-returns/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<PurchaseReturn>(`/api/purchase-returns/${id}/unaudit`, 'POST'),
};

export const paymentApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<Payment>>(`/api/payments?${qs}`);
  },
  get: (id: string) => request<Payment>(`/api/payments/${id}`),
  create: (data: Partial<Payment>) => request<Payment>('/api/payments', 'POST', data),
  update: (id: string, data: Partial<Payment>) => request<Payment>(`/api/payments/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/payments/${id}`, 'DELETE'),
  audit: (id: string) => request<Payment>(`/api/payments/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<Payment>(`/api/payments/${id}/unaudit`, 'POST'),
};

export const stockInApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<StockIn>>(`/api/stock-ins?${qs}`);
  },
  get: (id: string) => request<StockIn>(`/api/stock-ins/${id}`),
  create: (data: Partial<StockIn>) => request<StockIn>('/api/stock-ins', 'POST', data),
  update: (id: string, data: Partial<StockIn>) => request<StockIn>(`/api/stock-ins/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/stock-ins/${id}`, 'DELETE'),
  audit: (id: string) => request<StockIn>(`/api/stock-ins/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<StockIn>(`/api/stock-ins/${id}/unaudit`, 'POST'),
};

export const stockOutApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<StockOut>>(`/api/stock-outs?${qs}`);
  },
  get: (id: string) => request<StockOut>(`/api/stock-outs/${id}`),
  create: (data: Partial<StockOut>) => request<StockOut>('/api/stock-outs', 'POST', data),
  update: (id: string, data: Partial<StockOut>) => request<StockOut>(`/api/stock-outs/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/stock-outs/${id}`, 'DELETE'),
  audit: (id: string) => request<StockOut>(`/api/stock-outs/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<StockOut>(`/api/stock-outs/${id}/unaudit`, 'POST'),
};

export const materialRequisitionApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<MaterialRequisition>>(`/api/material-requisitions?${qs}`);
  },
  get: (id: string) => request<MaterialRequisition>(`/api/material-requisitions/${id}`),
  create: (data: Partial<MaterialRequisition>) => request<MaterialRequisition>('/api/material-requisitions', 'POST', data),
  update: (id: string, data: Partial<MaterialRequisition>) => request<MaterialRequisition>(`/api/material-requisitions/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/material-requisitions/${id}`, 'DELETE'),
  audit: (id: string) => request<MaterialRequisition>(`/api/material-requisitions/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<MaterialRequisition>(`/api/material-requisitions/${id}/unaudit`, 'POST'),
};

export const materialReturnApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<MaterialReturn>>(`/api/material-returns?${qs}`);
  },
  get: (id: string) => request<MaterialReturn>(`/api/material-returns/${id}`),
  create: (data: Partial<MaterialReturn>) => request<MaterialReturn>('/api/material-returns', 'POST', data),
  update: (id: string, data: Partial<MaterialReturn>) => request<MaterialReturn>(`/api/material-returns/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/material-returns/${id}`, 'DELETE'),
  audit: (id: string) => request<MaterialReturn>(`/api/material-returns/${id}/audit`, 'POST'),
  unaudit: (id: string) => request<MaterialReturn>(`/api/material-returns/${id}/unaudit`, 'POST'),
};

export const financeIncomeApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<FinanceIncome>>(`/api/finance-incomes?${qs}`);
  },
  get: (id: string) => request<FinanceIncome>(`/api/finance-incomes/${id}`),
  create: (data: Partial<FinanceIncome>) => request<FinanceIncome>('/api/finance-incomes', 'POST', data),
  update: (id: string, data: Partial<FinanceIncome>) => request<FinanceIncome>(`/api/finance-incomes/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/finance-incomes/${id}`, 'DELETE'),
};

export const financeExpenseApi = {
  list: (params: Record<string, unknown>) => {
    const qs = buildQuery(params);
    return request<PageResult<FinanceExpense>>(`/api/finance-expenses?${qs}`);
  },
  get: (id: string) => request<FinanceExpense>(`/api/finance-expenses/${id}`),
  create: (data: Partial<FinanceExpense>) => request<FinanceExpense>('/api/finance-expenses', 'POST', data),
  update: (id: string, data: Partial<FinanceExpense>) => request<FinanceExpense>(`/api/finance-expenses/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/finance-expenses/${id}`, 'DELETE'),
};

export const financeItemApi = {
  list: (params: { type?: string } = {}) =>
    request<FinanceItem[]>(`/api/finance-items${params.type ? `?type=${params.type}` : ''}`),
  create: (data: Partial<FinanceItem>) => request<FinanceItem>('/api/finance-items', 'POST', data),
  update: (id: string, data: Partial<FinanceItem>) => request<FinanceItem>(`/api/finance-items/${id}`, 'PUT', data),
  remove: (id: string) => request<void>(`/api/finance-items/${id}`, 'DELETE'),
};

export const statementApi = {
  getCustomer: (params: { customerId: string; startDate?: string; endDate?: string }) => {
    const qs = buildQuery(params);
    return request<CustomerStatement>(`/api/statements/customer?${qs}`);
  },
  list: (params: { keyword?: string; startDate?: string; endDate?: string }) => {
    const qs = buildQuery(params);
    return request<CustomerStatement[]>(`/api/statements?${qs}`);
  },
};

export const inventoryApi = {
  list: (params: { page?: number; pageSize?: number; keyword?: string; warehouseId?: string }) => {
    const qs = buildQuery(params);
    return request<PageResult<Product>>(`/api/inventory?${qs}`);
  },
};

export const systemApi = {
  login: (data: { username: string; password: string }) =>
    request<{ success: boolean; message?: string; user?: SysUser }>('/api/auth/login', 'POST', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    request<{ success: boolean; message?: string }>('/api/auth/change-password', 'POST', data),
  userList: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<SysUser>>(`/api/sys-users?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  userCreate: (data: Partial<SysUser> & { password: string }) => request<SysUser>('/api/sys-users', 'POST', data),
  userUpdate: (id: string, data: Partial<SysUser>) => request<SysUser>(`/api/sys-users/${id}`, 'PUT', data),
  userRemove: (id: string) => request<void>(`/api/sys-users/${id}`, 'DELETE'),
  logList: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request<PageResult<SysLog>>(`/api/sys-logs?page=${params.page || 1}&pageSize=${params.pageSize || 20}&keyword=${params.keyword || ''}`),
  paramList: () => request<SysParam[]>('/api/sys-params'),
  paramUpdate: (id: string, data: Partial<SysParam>) => request<SysParam>(`/api/sys-params/${id}`, 'PUT', data),
};
