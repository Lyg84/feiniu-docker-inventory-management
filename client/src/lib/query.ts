/**
 * 构造查询串：跳过 undefined / null / 空串 / 字面量 'undefined'。
 * 日期、数字列不接受非预期字面量，因此缺省参数不能落成字符串再传给后端。
 */
export function buildQuery(params: object): string {
  const usp = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s || s === 'undefined' || s === 'null') return;
    usp.append(k, s);
  });
  return usp.toString();
}
