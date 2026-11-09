import { inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';

import { sysParam } from '@server/database/schema';

export interface OrderNoSettings {
  /** 流水号位数 */
  digits: number;
  /** 每月第一张单据的起始流水号 */
  start: number;
}

export const DEFAULT_DIGITS = 4;
export const DEFAULT_START = 1;

const clampInt = (raw: string | null | undefined, fallback: number, min: number, max: number): number => {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
};

/** 从 sys_param 读单号规则；读不到就按默认 4 位、起始 1 */
export async function getOrderNoSettings(db: PostgresJsDatabase): Promise<OrderNoSettings> {
  try {
    const rows = await db
      .select({ paramKey: sysParam.paramKey, paramValue: sysParam.paramValue })
      .from(sysParam)
      .where(inArray(sysParam.paramKey, ['order_no_digits', 'order_no_start']));
    const map = new Map<string, string | null>();
    rows.forEach((r: { paramKey: string; paramValue: string | null }) => map.set(r.paramKey, r.paramValue));
    return {
      digits: clampInt(map.get('order_no_digits'), DEFAULT_DIGITS, 1, 10),
      start: clampInt(map.get('order_no_start'), DEFAULT_START, 1, 9999999),
    };
  } catch {
    return { digits: DEFAULT_DIGITS, start: DEFAULT_START };
  }
}

/** 拼「前缀 + 指定位数的流水号」 */
export function formatOrderNo(prefix: string, seq: number, digits: number): string {
  return `${prefix}${String(seq).padStart(digits, '0')}`;
}

/** 本地时区的今天（yyyy-MM-dd），避免深夜下单落到 UTC 的前一天 */
export function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 从已有单号里取出流水号，取不到返回 null */
export function parseOrderSeq(orderNo: string | null | undefined, prefix: string): number | null {
  if (!orderNo || !orderNo.startsWith(prefix)) return null;
  const num = parseInt(orderNo.slice(prefix.length), 10);
  return Number.isNaN(num) ? null : num;
}
