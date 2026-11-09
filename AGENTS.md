# 进销存管理系统（Inventory & Sales Management System）

传统进销存软件风格的企业级管理系统，覆盖销售、采购、仓库、财务、基础资料、系统管理六大模块。

## 技术栈
- 后端：NestJS 10 + Drizzle ORM + PostgreSQL
- 前端：React 19 + Tailwind CSS + antd Table + shadcn/ui
- 布局：左侧菜单 + 右侧内容区，传统 ERP 风格

## 设计规范
- 整体风格：传统进销存软件风格，信息密度高，表格为主
- 主色调：深蓝色系（#1e40af / #1e3a8a），工具栏浅灰底
- 布局：左侧固定菜单（220px）+ 顶部工具栏 + 主内容区
- 表格：antd Table，固定表头，行高紧凑
- 表单：弹窗式录入，两列布局
- 间距：内边距统一用 p-4，表格区域 gap-2
- 字体：系统默认字体，小字号为主（text-sm）

## 模块结构

### 一、销售管理
- 开送货单（销售送货单新增）
- 销售退货单
- 批量打印送货单
- 客户对账单
- 销售单据查找
- 批量标记送货单

### 二、采购管理
- 采购进库
- 采购退货
- 采购单据查找

### 三、仓库管理
- 产品进库单
- 产品出库单
- 存货查询
- 仓库单据查询

### 四、财务管理
- 销售收款单
- 批量核销收款
- 采购付款单
- 财务单据查找

### 五、基础资料
- 产品资料
- 客户资料
- 联系人资料

### 六、系统管理
- 登陆密码修改
- 数据备份
- 数据恢复
- 系统参数设置
- 自定义报表

## 数据实体（核心表）
- customer 客户
- product 产品
- supplier 供应商
- employee 职员
- sales_delivery 销售送货单 + sales_delivery_item 明细
- sales_return 销售退货单 + sales_return_item 明细
- purchase_in 采购入库单 + purchase_in_item 明细
- purchase_return 采购退货单 + purchase_return_item 明细
- stock_in 产品进仓单 + stock_in_item 明细
- stock_out 产品出仓单 + stock_out_item 明细
- material_requisition 材料领用单 + 明细
- material_return 材料退仓单 + 明细
- receipt 收款单 + receipt_item 核销明细
- payment 付款单 + payment_item 核销明细
- finance_income 财务收入单
- finance_expense 财务支出单
- finance_item 财务收支项目
- stock_inventory 库存表
- sys_user 系统用户
- sys_log 操作日志
- sys_param 系统参数

## 核心业务规则
1. 客户名称去重，输入客户后自动存入
2. 商品名称+单价自动存入产品库
3. 下单时显示该商品对应当前客户近五次历史价格
4. 单据支持审核/反审核状态流转
5. 对账单支持打印
6. 所有列表支持导出
