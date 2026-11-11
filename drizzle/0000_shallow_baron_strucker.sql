-- 本地化补丁：平台自定义复合类型 user_profile（原由妙搭平台在库内预建）
CREATE TYPE "user_profile" AS ("id" uuid);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_person" varchar(100),
	"phone" varchar(50),
	"address" text,
	"remark" text,
	"total_amount" numeric DEFAULT '0',
	"paid_amount" numeric DEFAULT '0',
	"debt_amount" numeric DEFAULT '0',
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "customer_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(50),
	"position" varchar(100),
	"department" varchar(100),
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "finance_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_no" varchar(50) NOT NULL,
	"expense_date" date DEFAULT CURRENT_DATE NOT NULL,
	"item_id" uuid,
	"item_name" varchar(200),
	"amount" numeric DEFAULT '0' NOT NULL,
	"payee" varchar(200),
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "finance_expense_expense_no_unique" UNIQUE("expense_no")
);
--> statement-breakpoint
CREATE TABLE "finance_income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"income_no" varchar(50) NOT NULL,
	"income_date" date DEFAULT CURRENT_DATE NOT NULL,
	"item_id" uuid,
	"item_name" varchar(200),
	"amount" numeric DEFAULT '0' NOT NULL,
	"payer" varchar(200),
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "finance_income_income_no_unique" UNIQUE("income_no")
);
--> statement-breakpoint
CREATE TABLE "finance_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(20) NOT NULL,
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "material_requisition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"req_no" varchar(50) NOT NULL,
	"req_date" date DEFAULT CURRENT_DATE NOT NULL,
	"warehouse_id" uuid,
	"department" varchar(100),
	"applicant" varchar(100),
	"total_qty" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "material_requisition_req_no_unique" UNIQUE("req_no")
);
--> statement-breakpoint
CREATE TABLE "material_requisition_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"req_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "material_return" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_no" varchar(50) NOT NULL,
	"return_date" date DEFAULT CURRENT_DATE NOT NULL,
	"warehouse_id" uuid,
	"department" varchar(100),
	"total_qty" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "material_return_return_no_unique" UNIQUE("return_no")
);
--> statement-breakpoint
CREATE TABLE "material_return_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_no" varchar(50) NOT NULL,
	"payment_date" date DEFAULT CURRENT_DATE NOT NULL,
	"supplier_id" uuid NOT NULL,
	"total_amount" numeric DEFAULT '0' NOT NULL,
	"write_off_amount" numeric DEFAULT '0',
	"payment_method" varchar(50),
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "payment_payment_no_unique" UNIQUE("payment_no")
);
--> statement-breakpoint
CREATE TABLE "payment_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"in_id" uuid,
	"amount" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"price" numeric DEFAULT '0',
	"stock_qty" numeric DEFAULT '0',
	"category" varchar(100),
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile"
);
--> statement-breakpoint
CREATE TABLE "purchase_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"in_no" varchar(50) NOT NULL,
	"in_date" date DEFAULT CURRENT_DATE NOT NULL,
	"supplier_id" uuid NOT NULL,
	"total_amount" numeric DEFAULT '0',
	"paid_amount" numeric DEFAULT '0',
	"debt_amount" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "purchase_in_in_no_unique" UNIQUE("in_no")
);
--> statement-breakpoint
CREATE TABLE "purchase_in_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"in_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"price" numeric DEFAULT '0' NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "purchase_return" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_no" varchar(50) NOT NULL,
	"return_date" date DEFAULT CURRENT_DATE NOT NULL,
	"supplier_id" uuid NOT NULL,
	"in_id" uuid,
	"total_amount" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "purchase_return_return_no_unique" UNIQUE("return_no")
);
--> statement-breakpoint
CREATE TABLE "purchase_return_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"price" numeric DEFAULT '0' NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_no" varchar(50) NOT NULL,
	"receipt_date" date DEFAULT CURRENT_DATE NOT NULL,
	"customer_id" uuid NOT NULL,
	"total_amount" numeric DEFAULT '0' NOT NULL,
	"write_off_amount" numeric DEFAULT '0',
	"payment_method" varchar(50),
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "receipt_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE TABLE "receipt_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"delivery_id" uuid,
	"amount" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sales_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" varchar(50) NOT NULL,
	"order_date" date DEFAULT CURRENT_DATE NOT NULL,
	"customer_id" uuid NOT NULL,
	"total_amount" numeric DEFAULT '0',
	"paid_amount" numeric DEFAULT '0',
	"debt_amount" numeric DEFAULT '0',
	"receipt_status" varchar(20) DEFAULT 'unreceived',
	"return_status" varchar(20) DEFAULT 'pending',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "sales_delivery_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "sales_delivery_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"price" numeric DEFAULT '0' NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"remark" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sales_return" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_no" varchar(50) NOT NULL,
	"return_date" date DEFAULT CURRENT_DATE NOT NULL,
	"customer_id" uuid NOT NULL,
	"delivery_id" uuid,
	"total_amount" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "sales_return_return_no_unique" UNIQUE("return_no")
);
--> statement-breakpoint
CREATE TABLE "sales_return_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"price" numeric DEFAULT '0' NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "stock_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"in_no" varchar(50) NOT NULL,
	"in_date" date DEFAULT CURRENT_DATE NOT NULL,
	"warehouse_id" uuid,
	"total_qty" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "stock_in_in_no_unique" UNIQUE("in_no")
);
--> statement-breakpoint
CREATE TABLE "stock_in_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"in_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "stock_out" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"out_no" varchar(50) NOT NULL,
	"out_date" date DEFAULT CURRENT_DATE NOT NULL,
	"warehouse_id" uuid,
	"total_qty" numeric DEFAULT '0',
	"audit_status" varchar(20) DEFAULT 'draft',
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "stock_out_out_no_unique" UNIQUE("out_no")
);
--> statement-breakpoint
CREATE TABLE "stock_out_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"out_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(200) NOT NULL,
	"spec" varchar(200),
	"unit" varchar(20),
	"quantity" numeric DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_person" varchar(100),
	"phone" varchar(50),
	"address" text,
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "supplier_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sys_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"username" varchar(100),
	"action" varchar(100),
	"module" varchar(100),
	"detail" text,
	"ip" varchar(50),
	"created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_param" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"param_key" varchar(100) NOT NULL,
	"param_value" text,
	"param_name" varchar(200),
	"remark" text,
	CONSTRAINT "sys_param_param_key_unique" UNIQUE("param_key")
);
--> statement-breakpoint
CREATE TABLE "sys_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(100),
	"role" varchar(50) DEFAULT 'user',
	"status" varchar(20) DEFAULT 'active',
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "sys_user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "warehouse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text,
	"manager" varchar(100),
	"remark" text,
	"_created_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_created_by" "user_profile",
	"_updated_at" timestamptz (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"_updated_by" "user_profile",
	CONSTRAINT "warehouse_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "finance_expense" ADD CONSTRAINT "finance_expense_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."finance_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_income" ADD CONSTRAINT "finance_income_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."finance_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requisition" ADD CONSTRAINT "material_requisition_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requisition_item" ADD CONSTRAINT "material_requisition_item_req_id_fkey" FOREIGN KEY ("req_id") REFERENCES "public"."material_requisition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requisition_item" ADD CONSTRAINT "material_requisition_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_return" ADD CONSTRAINT "material_return_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_return_item" ADD CONSTRAINT "material_return_item_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "public"."material_return"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_return_item" ADD CONSTRAINT "material_return_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_item" ADD CONSTRAINT "payment_item_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_item" ADD CONSTRAINT "payment_item_in_id_fkey" FOREIGN KEY ("in_id") REFERENCES "public"."purchase_in"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_in" ADD CONSTRAINT "purchase_in_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_in_item" ADD CONSTRAINT "purchase_in_item_in_id_fkey" FOREIGN KEY ("in_id") REFERENCES "public"."purchase_in"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_in_item" ADD CONSTRAINT "purchase_in_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return" ADD CONSTRAINT "purchase_return_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return" ADD CONSTRAINT "purchase_return_in_id_fkey" FOREIGN KEY ("in_id") REFERENCES "public"."purchase_in"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_item" ADD CONSTRAINT "purchase_return_item_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "public"."purchase_return"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_item" ADD CONSTRAINT "purchase_return_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_item" ADD CONSTRAINT "receipt_item_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_item" ADD CONSTRAINT "receipt_item_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."sales_delivery"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery" ADD CONSTRAINT "sales_delivery_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_item" ADD CONSTRAINT "sales_delivery_item_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."sales_delivery"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_item" ADD CONSTRAINT "sales_delivery_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return" ADD CONSTRAINT "sales_return_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return" ADD CONSTRAINT "sales_return_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."sales_delivery"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_item" ADD CONSTRAINT "sales_return_item_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "public"."sales_return"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_item" ADD CONSTRAINT "sales_return_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in" ADD CONSTRAINT "stock_in_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_item" ADD CONSTRAINT "stock_in_item_in_id_fkey" FOREIGN KEY ("in_id") REFERENCES "public"."stock_in"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_item" ADD CONSTRAINT "stock_in_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_out" ADD CONSTRAINT "stock_out_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_out_item" ADD CONSTRAINT "stock_out_item_out_id_fkey" FOREIGN KEY ("out_id") REFERENCES "public"."stock_out"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_out_item" ADD CONSTRAINT "stock_out_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_name_key" ON "customer" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_expense_expense_no_key" ON "finance_expense" USING btree ("expense_no");--> statement-breakpoint
CREATE INDEX "idx_fe_date" ON "finance_expense" USING btree ("expense_date");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_income_income_no_key" ON "finance_income" USING btree ("income_no");--> statement-breakpoint
CREATE INDEX "idx_fi_date" ON "finance_income" USING btree ("income_date");--> statement-breakpoint
CREATE UNIQUE INDEX "material_requisition_req_no_key" ON "material_requisition" USING btree ("req_no");--> statement-breakpoint
CREATE INDEX "idx_mri_req" ON "material_requisition_item" USING btree ("req_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_return_return_no_key" ON "material_return" USING btree ("return_no");--> statement-breakpoint
CREATE INDEX "idx_mret_item" ON "material_return_item" USING btree ("return_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_payment_no_key" ON "payment" USING btree ("payment_no");--> statement-breakpoint
CREATE INDEX "idx_payment_supplier" ON "payment" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_pi_payment" ON "payment_item" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_in_in_no_key" ON "purchase_in" USING btree ("in_no");--> statement-breakpoint
CREATE INDEX "idx_pi_supplier" ON "purchase_in" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_pi_date" ON "purchase_in" USING btree ("in_date");--> statement-breakpoint
CREATE INDEX "idx_pii_in" ON "purchase_in_item" USING btree ("in_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_return_return_no_key" ON "purchase_return" USING btree ("return_no");--> statement-breakpoint
CREATE INDEX "idx_pr_supplier" ON "purchase_return" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_pri_return" ON "purchase_return_item" USING btree ("return_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_receipt_no_key" ON "receipt" USING btree ("receipt_no");--> statement-breakpoint
CREATE INDEX "idx_receipt_customer" ON "receipt" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_receipt_date" ON "receipt" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "idx_ri_receipt" ON "receipt_item" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "idx_ri_delivery" ON "receipt_item" USING btree ("delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_delivery_order_no_key" ON "sales_delivery" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "idx_sales_delivery_customer" ON "sales_delivery" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_delivery_date" ON "sales_delivery" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_sales_delivery_status" ON "sales_delivery" USING btree ("audit_status");--> statement-breakpoint
CREATE INDEX "idx_sdi_delivery" ON "sales_delivery_item" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "idx_sdi_product" ON "sales_delivery_item" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_return_return_no_key" ON "sales_return" USING btree ("return_no");--> statement-breakpoint
CREATE INDEX "idx_sr_customer" ON "sales_return" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sr_delivery" ON "sales_return" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "idx_sri_return" ON "sales_return_item" USING btree ("return_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_in_in_no_key" ON "stock_in" USING btree ("in_no");--> statement-breakpoint
CREATE INDEX "idx_stkin_wh" ON "stock_in" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_stkii_in" ON "stock_in_item" USING btree ("in_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_out_out_no_key" ON "stock_out" USING btree ("out_no");--> statement-breakpoint
CREATE INDEX "idx_stkout_wh" ON "stock_out" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_stkoi_out" ON "stock_out_item" USING btree ("out_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_name_key" ON "supplier" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_syslog_time" ON "sys_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_syslog_user" ON "sys_log" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_param_param_key_key" ON "sys_param" USING btree ("param_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_user_username_key" ON "sys_user" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_name_key" ON "warehouse" USING btree ("name");