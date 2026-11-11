export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  remark?: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  spec?: string;
  unit?: string;
  price: number;
  stockQty: number;
  category?: string;
  remark?: string;
  createdAt?: string;
  /** 历史被选中/开单的次数，用于下拉排序（常用优先） */
  usageCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  remark?: string;
}

export interface Employee {
  id: string;
  name: string;
  phone?: string;
  position?: string;
  department?: string;
  remark?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  manager?: string;
  remark?: string;
}

export interface FinanceItem {
  id: string;
  name: string;
  type: 'income' | 'expense';
  remark?: string;
}

export interface DeliveryItem {
  id?: string;
  productId?: string;
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  price: number;
  amount: number;
  remark?: string;
  sortOrder?: number;
}

export interface SalesDelivery {
  id: string;
  orderNo: string;
  orderDate: string;
  customerId: string;
  customerName?: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  receiptStatus: string;
  returnStatus: string;
  auditStatus: 'draft' | 'audited';
  printStatus?: 'unprinted' | 'printed';
  printCount?: number;
  printedAt?: string;
  remark?: string;
  items?: DeliveryItem[];
  createdAt?: string;
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  customerId: string;
  customerName?: string;
  deliveryId?: string;
  deliveryNo?: string;
  totalAmount: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: DeliveryItem[];
  createdAt?: string;
}

export interface ReceiptItem {
  id?: string;
  deliveryId?: string;
  deliveryNo?: string;
  amount: number;
  sortOrder?: number;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  receiptDate: string;
  customerId: string;
  customerName?: string;
  totalAmount: number;
  writeOffAmount: number;
  paymentMethod?: string;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: ReceiptItem[];
  createdAt?: string;
}

export interface PurchaseIn {
  id: string;
  inNo: string;
  inDate: string;
  supplierId: string;
  supplierName?: string;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: DeliveryItem[];
  createdAt?: string;
}

export interface PurchaseReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  supplierId: string;
  supplierName?: string;
  inId?: string;
  inNo?: string;
  totalAmount: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: DeliveryItem[];
  createdAt?: string;
}

export interface Payment {
  id: string;
  paymentNo: string;
  paymentDate: string;
  supplierId: string;
  supplierName?: string;
  totalAmount: number;
  writeOffAmount: number;
  paymentMethod?: string;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: { id?: string; inId?: string; inNo?: string; amount: number; sortOrder?: number }[];
  createdAt?: string;
}

export interface StockIn {
  id: string;
  inNo: string;
  inDate: string;
  warehouseId?: string;
  warehouseName?: string;
  totalQty: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: { id?: string; productId?: string; productName: string; spec?: string; unit?: string; quantity: number; sortOrder?: number }[];
  createdAt?: string;
}

export interface StockOut {
  id: string;
  outNo: string;
  outDate: string;
  warehouseId?: string;
  warehouseName?: string;
  totalQty: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: { id?: string; productId?: string; productName: string; spec?: string; unit?: string; quantity: number; sortOrder?: number }[];
  createdAt?: string;
}

export interface MaterialRequisition {
  id: string;
  reqNo: string;
  reqDate: string;
  warehouseId?: string;
  warehouseName?: string;
  department?: string;
  applicant?: string;
  totalQty: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: { id?: string; productId?: string; productName: string; spec?: string; unit?: string; quantity: number; sortOrder?: number }[];
  createdAt?: string;
}

export interface MaterialReturn {
  id: string;
  returnNo: string;
  returnDate: string;
  warehouseId?: string;
  warehouseName?: string;
  department?: string;
  totalQty: number;
  auditStatus: 'draft' | 'audited';
  remark?: string;
  items?: { id?: string; productId?: string; productName: string; spec?: string; unit?: string; quantity: number; sortOrder?: number }[];
  createdAt?: string;
}

export interface FinanceIncome {
  id: string;
  incomeNo: string;
  incomeDate: string;
  itemId?: string;
  itemName?: string;
  amount: number;
  payer?: string;
  auditStatus: string;
  remark?: string;
  createdAt?: string;
}

export interface FinanceExpense {
  id: string;
  expenseNo: string;
  expenseDate: string;
  itemId?: string;
  itemName?: string;
  amount: number;
  payee?: string;
  auditStatus: string;
  remark?: string;
  createdAt?: string;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  totalSales: number;
  totalReceipt: number;
  totalReturn: number;
  debtAmount: number;
  /** 未审核（草稿）送货单：只用于提示，不计入 totalSales */
  pendingDeliveryCount?: number;
  pendingDeliveryAmount?: number;
  /** 未审核（草稿）退货单：不计入 totalReturn */
  pendingReturnCount?: number;
  pendingReturnAmount?: number;
  /** 未审核（草稿）收款单：不计入 totalReceipt */
  pendingReceiptCount?: number;
  pendingReceiptAmount?: number;
  records: {
    date: string;
    type: 'delivery' | 'receipt' | 'return';
    no: string;
    salesAmount: number;
    receiptAmount: number;
    returnAmount: number;
    balance: number;
  }[];
}

export interface SysUser {
  id: string;
  username: string;
  name?: string;
  role: string;
  status: string;
}

export interface SysLog {
  id: string;
  username?: string;
  action?: string;
  module?: string;
  detail?: string;
  ip?: string;
  createdAt: string;
}

export interface SysParam {
  id: string;
  paramKey: string;
  paramValue?: string;
  paramName?: string;
  remark?: string;
}

export interface PriceHistory {
  date: string;
  orderNo: string;
  /** 规格型号：历史价按「商品+规格」分别统计 */
  spec?: string;
  /** 该单据是否已审核；未审核的仅作参考 */
  audited?: boolean;
  price: number;
  quantity: number;
}

/** 备份文件（pg_dump 自定义格式，后缀 .dump） */
export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
  /** manual=手动备份，pre-restore=还原前自动快照，upload=从本地上传 */
  kind: 'manual' | 'pre-restore' | 'pre-clear' | 'upload';
}

/** 一键清空业务数据的结果 */
export interface ClearDataResult {
  preSnapshot: string;
  before: Record<string, number>;
  after: Record<string, number>;
  message: string;
}

/** 备份能力自检结果 */
export interface BackupStatus {
  available: boolean;
  version: string;
  dir: string;
  database: string;
  host: string;
}
