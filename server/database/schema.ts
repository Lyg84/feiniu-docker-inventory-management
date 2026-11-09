/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { date, foreignKey, index, integer, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const sysParam = pgTable("sys_param", {
  id: uuid("id").primaryKey().defaultRandom(),
  paramKey: varchar("param_key", { length: 100 }).notNull().unique(),
  paramValue: text("param_value"),
  paramName: varchar("param_name", { length: 200 }),
  remark: text("remark"),
}, (table) => [
  uniqueIndex("sys_param_param_key_key").on(table.paramKey),
]);

export const sysLog = pgTable("sys_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  username: varchar("username", { length: 100 }),
  action: varchar("action", { length: 100 }),
  module: varchar("module", { length: 100 }),
  detail: text("detail"),
  ip: varchar("ip", { length: 50 }),
  createdAt: customTimestamptz("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_syslog_time").on(table.createdAt),
  index("idx_syslog_user").on(table.username),
]);

export const sysUser = pgTable("sys_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 50 }).default('user'),
  status: varchar("status", { length: 20 }).default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("sys_user_username_key").on(table.username),
]);

export const financeExpense = pgTable("finance_expense", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseNo: varchar("expense_no", { length: 50 }).notNull().unique(),
  expenseDate: date("expense_date").notNull().default('CURRENT_DATE'),
  itemId: uuid("item_id"),
  itemName: varchar("item_name", { length: 200 }),
  amount: numeric("amount").notNull().default('0'),
  payee: varchar("payee", { length: 200 }),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("finance_expense_expense_no_key").on(table.expenseNo),
  index("idx_fe_date").on(table.expenseDate),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [financeItem.id],
    name: "finance_expense_item_id_fkey",
  }),
]);

export const financeIncome = pgTable("finance_income", {
  id: uuid("id").primaryKey().defaultRandom(),
  incomeNo: varchar("income_no", { length: 50 }).notNull().unique(),
  incomeDate: date("income_date").notNull().default('CURRENT_DATE'),
  itemId: uuid("item_id"),
  itemName: varchar("item_name", { length: 200 }),
  amount: numeric("amount").notNull().default('0'),
  payer: varchar("payer", { length: 200 }),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("finance_income_income_no_key").on(table.incomeNo),
  index("idx_fi_date").on(table.incomeDate),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [financeItem.id],
    name: "finance_income_item_id_fkey",
  }),
]);

export const materialReturnItem = pgTable("material_return_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_mret_item").on(table.returnId),
  foreignKey({
    columns: [table.returnId],
    foreignColumns: [materialReturn.id],
    name: "material_return_item_return_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "material_return_item_product_id_fkey",
  }),
]);

export const materialReturn = pgTable("material_return", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnNo: varchar("return_no", { length: 50 }).notNull().unique(),
  returnDate: date("return_date").notNull().default('CURRENT_DATE'),
  warehouseId: uuid("warehouse_id"),
  department: varchar("department", { length: 100 }),
  totalQty: numeric("total_qty").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("material_return_return_no_key").on(table.returnNo),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouse.id],
    name: "material_return_warehouse_id_fkey",
  }),
]);

export const materialRequisitionItem = pgTable("material_requisition_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  reqId: uuid("req_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_mri_req").on(table.reqId),
  foreignKey({
    columns: [table.reqId],
    foreignColumns: [materialRequisition.id],
    name: "material_requisition_item_req_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "material_requisition_item_product_id_fkey",
  }),
]);

export const materialRequisition = pgTable("material_requisition", {
  id: uuid("id").primaryKey().defaultRandom(),
  reqNo: varchar("req_no", { length: 50 }).notNull().unique(),
  reqDate: date("req_date").notNull().default('CURRENT_DATE'),
  warehouseId: uuid("warehouse_id"),
  department: varchar("department", { length: 100 }),
  applicant: varchar("applicant", { length: 100 }),
  totalQty: numeric("total_qty").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("material_requisition_req_no_key").on(table.reqNo),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouse.id],
    name: "material_requisition_warehouse_id_fkey",
  }),
]);

export const stockOutItem = pgTable("stock_out_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  outId: uuid("out_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_stkoi_out").on(table.outId),
  foreignKey({
    columns: [table.outId],
    foreignColumns: [stockOut.id],
    name: "stock_out_item_out_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "stock_out_item_product_id_fkey",
  }),
]);

export const stockOut = pgTable("stock_out", {
  id: uuid("id").primaryKey().defaultRandom(),
  outNo: varchar("out_no", { length: 50 }).notNull().unique(),
  outDate: date("out_date").notNull().default('CURRENT_DATE'),
  warehouseId: uuid("warehouse_id"),
  totalQty: numeric("total_qty").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("stock_out_out_no_key").on(table.outNo),
  index("idx_stkout_wh").on(table.warehouseId),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouse.id],
    name: "stock_out_warehouse_id_fkey",
  }),
]);

export const stockInItem = pgTable("stock_in_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  inId: uuid("in_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_stkii_in").on(table.inId),
  foreignKey({
    columns: [table.inId],
    foreignColumns: [stockIn.id],
    name: "stock_in_item_in_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "stock_in_item_product_id_fkey",
  }),
]);

export const stockIn = pgTable("stock_in", {
  id: uuid("id").primaryKey().defaultRandom(),
  inNo: varchar("in_no", { length: 50 }).notNull().unique(),
  inDate: date("in_date").notNull().default('CURRENT_DATE'),
  warehouseId: uuid("warehouse_id"),
  totalQty: numeric("total_qty").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("stock_in_in_no_key").on(table.inNo),
  index("idx_stkin_wh").on(table.warehouseId),
  foreignKey({
    columns: [table.warehouseId],
    foreignColumns: [warehouse.id],
    name: "stock_in_warehouse_id_fkey",
  }),
]);

export const paymentItem = pgTable("payment_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull(),
  inId: uuid("in_id"),
  amount: numeric("amount").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_pi_payment").on(table.paymentId),
  foreignKey({
    columns: [table.paymentId],
    foreignColumns: [payment.id],
    name: "payment_item_payment_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.inId],
    foreignColumns: [purchaseIn.id],
    name: "payment_item_in_id_fkey",
  }),
]);

export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentNo: varchar("payment_no", { length: 50 }).notNull().unique(),
  paymentDate: date("payment_date").notNull().default('CURRENT_DATE'),
  supplierId: uuid("supplier_id").notNull(),
  totalAmount: numeric("total_amount").notNull().default('0'),
  writeOffAmount: numeric("write_off_amount").default('0'),
  paymentMethod: varchar("payment_method", { length: 50 }),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("payment_payment_no_key").on(table.paymentNo),
  index("idx_payment_supplier").on(table.supplierId),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [supplier.id],
    name: "payment_supplier_id_fkey",
  }),
]);

export const purchaseReturnItem = pgTable("purchase_return_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  price: numeric("price").notNull().default('0'),
  amount: numeric("amount").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_pri_return").on(table.returnId),
  foreignKey({
    columns: [table.returnId],
    foreignColumns: [purchaseReturn.id],
    name: "purchase_return_item_return_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "purchase_return_item_product_id_fkey",
  }),
]);

export const purchaseReturn = pgTable("purchase_return", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnNo: varchar("return_no", { length: 50 }).notNull().unique(),
  returnDate: date("return_date").notNull().default('CURRENT_DATE'),
  supplierId: uuid("supplier_id").notNull(),
  inId: uuid("in_id"),
  totalAmount: numeric("total_amount").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("purchase_return_return_no_key").on(table.returnNo),
  index("idx_pr_supplier").on(table.supplierId),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [supplier.id],
    name: "purchase_return_supplier_id_fkey",
  }),
  foreignKey({
    columns: [table.inId],
    foreignColumns: [purchaseIn.id],
    name: "purchase_return_in_id_fkey",
  }),
]);

export const purchaseInItem = pgTable("purchase_in_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  inId: uuid("in_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  price: numeric("price").notNull().default('0'),
  amount: numeric("amount").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_pii_in").on(table.inId),
  foreignKey({
    columns: [table.inId],
    foreignColumns: [purchaseIn.id],
    name: "purchase_in_item_in_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "purchase_in_item_product_id_fkey",
  }),
]);

export const purchaseIn = pgTable("purchase_in", {
  id: uuid("id").primaryKey().defaultRandom(),
  inNo: varchar("in_no", { length: 50 }).notNull().unique(),
  inDate: date("in_date").notNull().default('CURRENT_DATE'),
  supplierId: uuid("supplier_id").notNull(),
  totalAmount: numeric("total_amount").default('0'),
  paidAmount: numeric("paid_amount").default('0'),
  debtAmount: numeric("debt_amount").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("purchase_in_in_no_key").on(table.inNo),
  index("idx_pi_supplier").on(table.supplierId),
  index("idx_pi_date").on(table.inDate),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [supplier.id],
    name: "purchase_in_supplier_id_fkey",
  }),
]);

export const receiptItem = pgTable("receipt_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptId: uuid("receipt_id").notNull(),
  deliveryId: uuid("delivery_id"),
  amount: numeric("amount").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_ri_receipt").on(table.receiptId),
  index("idx_ri_delivery").on(table.deliveryId),
  foreignKey({
    columns: [table.receiptId],
    foreignColumns: [receipt.id],
    name: "receipt_item_receipt_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.deliveryId],
    foreignColumns: [salesDelivery.id],
    name: "receipt_item_delivery_id_fkey",
  }),
]);

export const receipt = pgTable("receipt", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptNo: varchar("receipt_no", { length: 50 }).notNull().unique(),
  receiptDate: date("receipt_date").notNull().default('CURRENT_DATE'),
  customerId: uuid("customer_id").notNull(),
  totalAmount: numeric("total_amount").notNull().default('0'),
  writeOffAmount: numeric("write_off_amount").default('0'),
  paymentMethod: varchar("payment_method", { length: 50 }),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("receipt_receipt_no_key").on(table.receiptNo),
  index("idx_receipt_customer").on(table.customerId),
  index("idx_receipt_date").on(table.receiptDate),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customer.id],
    name: "receipt_customer_id_fkey",
  }),
]);

export const salesReturnItem = pgTable("sales_return_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnId: uuid("return_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  price: numeric("price").notNull().default('0'),
  amount: numeric("amount").notNull().default('0'),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_sri_return").on(table.returnId),
  foreignKey({
    columns: [table.returnId],
    foreignColumns: [salesReturn.id],
    name: "sales_return_item_return_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "sales_return_item_product_id_fkey",
  }),
]);

export const salesReturn = pgTable("sales_return", {
  id: uuid("id").primaryKey().defaultRandom(),
  returnNo: varchar("return_no", { length: 50 }).notNull().unique(),
  returnDate: date("return_date").notNull().default('CURRENT_DATE'),
  customerId: uuid("customer_id").notNull(),
  deliveryId: uuid("delivery_id"),
  totalAmount: numeric("total_amount").default('0'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("sales_return_return_no_key").on(table.returnNo),
  index("idx_sr_customer").on(table.customerId),
  index("idx_sr_delivery").on(table.deliveryId),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customer.id],
    name: "sales_return_customer_id_fkey",
  }),
  foreignKey({
    columns: [table.deliveryId],
    foreignColumns: [salesDelivery.id],
    name: "sales_return_delivery_id_fkey",
  }),
]);

export const salesDeliveryItem = pgTable("sales_delivery_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  quantity: numeric("quantity").notNull().default('0'),
  price: numeric("price").notNull().default('0'),
  amount: numeric("amount").notNull().default('0'),
  remark: text("remark"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("idx_sdi_delivery").on(table.deliveryId),
  index("idx_sdi_product").on(table.productId),
  foreignKey({
    columns: [table.deliveryId],
    foreignColumns: [salesDelivery.id],
    name: "sales_delivery_item_delivery_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [product.id],
    name: "sales_delivery_item_product_id_fkey",
  }),
]);

export const salesDelivery = pgTable("sales_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNo: varchar("order_no", { length: 50 }).notNull().unique(),
  orderDate: date("order_date").notNull().default('CURRENT_DATE'),
  customerId: uuid("customer_id").notNull(),
  totalAmount: numeric("total_amount").default('0'),
  paidAmount: numeric("paid_amount").default('0'),
  debtAmount: numeric("debt_amount").default('0'),
  receiptStatus: varchar("receipt_status", { length: 20 }).default('unreceived'),
  returnStatus: varchar("return_status", { length: 20 }).default('pending'),
  auditStatus: varchar("audit_status", { length: 20 }).default('draft'),
  printStatus: varchar("print_status", { length: 20 }).default('unprinted'),
  printCount: integer("print_count").default(0),
  printedAt: customTimestamptz("printed_at", { precision: 3 }),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("sales_delivery_order_no_key").on(table.orderNo),
  index("idx_sales_delivery_customer").on(table.customerId),
  index("idx_sales_delivery_date").on(table.orderDate),
  index("idx_sales_delivery_status").on(table.auditStatus),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customer.id],
    name: "sales_delivery_customer_id_fkey",
  }),
]);

export const warehouse = pgTable("warehouse", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  address: text("address"),
  manager: varchar("manager", { length: 100 }),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("warehouse_name_key").on(table.name),
]);

export const financeItem = pgTable("finance_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const employee = pgTable("employee", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  position: varchar("position", { length: 100 }),
  department: varchar("department", { length: 100 }),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

export const supplier = pgTable("supplier", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  contactPerson: varchar("contact_person", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("supplier_name_key").on(table.name),
]);

export const product = pgTable("product", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  spec: varchar("spec", { length: 200 }),
  unit: varchar("unit", { length: 20 }),
  price: numeric("price").default('0'),
  stockQty: numeric("stock_qty").default('0'),
  category: varchar("category", { length: 100 }),
  remark: text("remark"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  // Complex index: CREATE UNIQUE INDEX idx_product_name_spec ON product USING btree (name, COALESCE(spec, ''::character varying)),
]);

export const customer = pgTable("customer", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  contactPerson: varchar("contact_person", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  remark: text("remark"),
  totalAmount: numeric("total_amount").default('0'),
  paidAmount: numeric("paid_amount").default('0'),
  debtAmount: numeric("debt_amount").default('0'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("customer_name_key").on(table.name),
]);

// table aliases
export const customerTable = customer;
export const employeeTable = employee;
export const financeExpenseTable = financeExpense;
export const financeIncomeTable = financeIncome;
export const financeItemTable = financeItem;
export const materialRequisitionTable = materialRequisition;
export const materialRequisitionItemTable = materialRequisitionItem;
export const materialReturnTable = materialReturn;
export const materialReturnItemTable = materialReturnItem;
export const paymentTable = payment;
export const paymentItemTable = paymentItem;
export const productTable = product;
export const purchaseInTable = purchaseIn;
export const purchaseInItemTable = purchaseInItem;
export const purchaseReturnTable = purchaseReturn;
export const purchaseReturnItemTable = purchaseReturnItem;
export const receiptTable = receipt;
export const receiptItemTable = receiptItem;
export const salesDeliveryTable = salesDelivery;
export const salesDeliveryItemTable = salesDeliveryItem;
export const salesReturnTable = salesReturn;
export const salesReturnItemTable = salesReturnItem;
export const stockInTable = stockIn;
export const stockInItemTable = stockInItem;
export const stockOutTable = stockOut;
export const stockOutItemTable = stockOutItem;
export const supplierTable = supplier;
export const sysLogTable = sysLog;
export const sysParamTable = sysParam;
export const sysUserTable = sysUser;
export const warehouseTable = warehouse;
