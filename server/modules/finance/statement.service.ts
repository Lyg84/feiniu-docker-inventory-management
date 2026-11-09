import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, like, sql, type SQLWrapper } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  customer,
  salesDelivery,
  salesReturn,
  receipt,
} from '@server/database/schema';
import type { CustomerStatement } from '@shared/api.interface';

const toNum = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
};

/**
 * 日期参数归一：只认 yyyy-mm-dd（可带时间部分，取日期段），并校验是真实存在的日期；
 * 其余（字面量 'undefined'、空串、2026-13-99 这类）一律视为未传，不让脏值进日期列。
 */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T][\d:.]*)?$/;

const normDate = (v?: string | null): string | undefined => {
  if (!v) return undefined;
  const s = String(v).trim();
  const m = s.match(DATE_RE);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return undefined;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
};

/** 关键字里的字面量 'undefined' 视为未传 */
const normKeyword = (v?: string | null): string | undefined => {
  if (!v) return undefined;
  const s = String(v).trim();
  if (!s || s === 'undefined' || s === 'null') return undefined;
  return s;
};

interface StatementRecord {
  date: string;
  type: 'delivery' | 'receipt' | 'return';
  no: string;
  salesAmount: number;
  receiptAmount: number;
  returnAmount: number;
  balance: number;
}

@Injectable()
export class StatementService {
  private readonly logger = new Logger(StatementService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(params: { keyword?: string; startDate?: string; endDate?: string }): Promise<CustomerStatement[]> {
    const start = normDate(params.startDate);
    const end = normDate(params.endDate);
    const kw = normKeyword(params.keyword);
    const conditions: SQLWrapper[] = [];
    if (kw) conditions.push(like(customer.name, `%${kw}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const customers = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        totalAmount: customer.totalAmount,
        paidAmount: customer.paidAmount,
        debtAmount: customer.debtAmount,
      })
      .from(customer)
      .where(where)
      .orderBy(customer.name);

    const result: CustomerStatement[] = [];

    for (const cust of customers) {
      const { totalSales, totalReceipt, totalReturn } = await this.getCustomerSummary(
        cust.id,
        start,
        end,
      );
      result.push({
        customerId: cust.id,
        customerName: cust.name,
        totalSales,
        totalReceipt,
        totalReturn,
        debtAmount: toNum(cust.debtAmount),
        records: [],
      });
    }

    return result;
  }

  private async getCustomerSummary(
    customerId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ totalSales: number; totalReceipt: number; totalReturn: number }> {
    const start = normDate(startDate);
    const end = normDate(endDate);
    const dateConditions = (dateCol: any) => {
      const conds = [];
      if (start) conds.push(gte(dateCol, start));
      if (end) conds.push(lte(dateCol, end));
      return conds;
    };

    const deliveryConds = [eq(salesDelivery.customerId, customerId), eq(salesDelivery.auditStatus, 'audited'), ...dateConditions(salesDelivery.orderDate)];
    const returnConds = [eq(salesReturn.customerId, customerId), eq(salesReturn.auditStatus, 'audited'), ...dateConditions(salesReturn.returnDate)];
    const receiptConds = [eq(receipt.customerId, customerId), eq(receipt.auditStatus, 'audited'), ...dateConditions(receipt.receiptDate)];

    const [deliverySum, returnSum, receiptSum] = await Promise.all([
      this.db
        .select({ total: sql<number>`coalesce(sum(${salesDelivery.totalAmount}), 0)` })
        .from(salesDelivery)
        .where(and(...deliveryConds)),
      this.db
        .select({ total: sql<number>`coalesce(sum(${salesReturn.totalAmount}), 0)` })
        .from(salesReturn)
        .where(and(...returnConds)),
      this.db
        .select({ total: sql<number>`coalesce(sum(${receipt.totalAmount}), 0)` })
        .from(receipt)
        .where(and(...receiptConds)),
    ]);

    return {
      totalSales: Number(deliverySum[0]?.total ?? 0),
      totalReturn: Number(returnSum[0]?.total ?? 0),
      totalReceipt: Number(receiptSum[0]?.total ?? 0),
    };
  }

  async getCustomerStatement(params: {
    customerId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<CustomerStatement> {
    const { customerId } = params;
    const start = normDate(params.startDate);
    const end = normDate(params.endDate);

    const custRows = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        totalAmount: customer.totalAmount,
        paidAmount: customer.paidAmount,
        debtAmount: customer.debtAmount,
      })
      .from(customer)
      .where(eq(customer.id, customerId))
      .limit(1);

    if (custRows.length === 0) throw new NotFoundException('客户不存在');

    const cust = custRows[0];
    const summary = await this.getCustomerSummary(customerId, start, end);

    // 拉取三类记录
    const records: StatementRecord[] = [];

    const deliveryWhere = [eq(salesDelivery.customerId, customerId), eq(salesDelivery.auditStatus, 'audited')];
    if (start) deliveryWhere.push(gte(salesDelivery.orderDate, start));
    if (end) deliveryWhere.push(lte(salesDelivery.orderDate, end));

    const deliveryRows = await this.db
      .select({
        date: salesDelivery.orderDate,
        no: salesDelivery.orderNo,
        amount: salesDelivery.totalAmount,
      })
      .from(salesDelivery)
      .where(and(...deliveryWhere));

    for (const row of deliveryRows) {
      records.push({
        date: row.date as string,
        type: 'delivery',
        no: row.no as string,
        salesAmount: toNum(row.amount),
        receiptAmount: 0,
        returnAmount: 0,
        balance: 0,
      });
    }

    const returnWhere = [eq(salesReturn.customerId, customerId), eq(salesReturn.auditStatus, 'audited')];
    if (start) returnWhere.push(gte(salesReturn.returnDate, start));
    if (end) returnWhere.push(lte(salesReturn.returnDate, end));

    const returnRows = await this.db
      .select({
        date: salesReturn.returnDate,
        no: salesReturn.returnNo,
        amount: salesReturn.totalAmount,
      })
      .from(salesReturn)
      .where(and(...returnWhere));

    for (const row of returnRows) {
      records.push({
        date: row.date as string,
        type: 'return',
        no: row.no as string,
        salesAmount: 0,
        receiptAmount: 0,
        returnAmount: toNum(row.amount),
        balance: 0,
      });
    }

    const receiptWhere = [eq(receipt.customerId, customerId), eq(receipt.auditStatus, 'audited')];
    if (start) receiptWhere.push(gte(receipt.receiptDate, start));
    if (end) receiptWhere.push(lte(receipt.receiptDate, end));

    const receiptRows = await this.db
      .select({
        date: receipt.receiptDate,
        no: receipt.receiptNo,
        amount: receipt.totalAmount,
      })
      .from(receipt)
      .where(and(...receiptWhere));

    for (const row of receiptRows) {
      records.push({
        date: row.date as string,
        type: 'receipt',
        no: row.no as string,
        salesAmount: 0,
        receiptAmount: toNum(row.amount),
        returnAmount: 0,
        balance: 0,
      });
    }

    // 按日期排序
    records.sort((a: StatementRecord, b: StatementRecord) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return a.no.localeCompare(b.no);
    });

    // 计算累计余额
    let balance = 0;
    for (const rec of records) {
      balance = balance + rec.salesAmount - rec.receiptAmount - rec.returnAmount;
      rec.balance = Number(balance.toFixed(2));
    }

    // 未审核（草稿）单据：不计入对账合计，单列张数与金额供页面提示
    const draftDeliveryWhere: SQLWrapper[] = [eq(salesDelivery.customerId, customerId), eq(salesDelivery.auditStatus, 'draft')];
    if (start) draftDeliveryWhere.push(gte(salesDelivery.orderDate, start));
    if (end) draftDeliveryWhere.push(lte(salesDelivery.orderDate, end));

    const draftReturnWhere: SQLWrapper[] = [eq(salesReturn.customerId, customerId), eq(salesReturn.auditStatus, 'draft')];
    if (start) draftReturnWhere.push(gte(salesReturn.returnDate, start));
    if (end) draftReturnWhere.push(lte(salesReturn.returnDate, end));

    const draftReceiptWhere: SQLWrapper[] = [eq(receipt.customerId, customerId), eq(receipt.auditStatus, 'draft')];
    if (start) draftReceiptWhere.push(gte(receipt.receiptDate, start));
    if (end) draftReceiptWhere.push(lte(receipt.receiptDate, end));

    const [draftDelivery, draftReturn, draftReceipt] = await Promise.all([
      this.db
        .select({
          c: sql<number>`count(*)`,
          a: sql<number>`coalesce(sum(${salesDelivery.totalAmount}), 0)`,
        })
        .from(salesDelivery)
        .where(and(...draftDeliveryWhere)),
      this.db
        .select({
          c: sql<number>`count(*)`,
          a: sql<number>`coalesce(sum(${salesReturn.totalAmount}), 0)`,
        })
        .from(salesReturn)
        .where(and(...draftReturnWhere)),
      this.db
        .select({
          c: sql<number>`count(*)`,
          a: sql<number>`coalesce(sum(${receipt.totalAmount}), 0)`,
        })
        .from(receipt)
        .where(and(...draftReceiptWhere)),
    ]);

    const pendingDeliveryCount = toNum(draftDelivery[0]?.c);
    const pendingDeliveryAmount = toNum(draftDelivery[0]?.a);
    const pendingReturnCount = toNum(draftReturn[0]?.c);
    const pendingReturnAmount = toNum(draftReturn[0]?.a);
    const pendingReceiptCount = toNum(draftReceipt[0]?.c);
    const pendingReceiptAmount = toNum(draftReceipt[0]?.a);

    return {
      customerId: cust.id,
      customerName: cust.name,
      totalSales: summary.totalSales,
      totalReceipt: summary.totalReceipt,
      totalReturn: summary.totalReturn,
      debtAmount: toNum(cust.debtAmount),
      pendingDeliveryCount,
      pendingDeliveryAmount,
      pendingReturnCount,
      pendingReturnAmount,
      pendingReceiptCount,
      pendingReceiptAmount,
      records,
    };
  }
}
