/**
 * 送货单打印模板（针式机 241mm × 140mm 二联二等分）
 *
 * 约定：
 * 1. 纸张 241mm 宽、140mm 高一页，左右各一联（存根联 / 客户联），中缝为撕纸位；
 * 2. 所有尺寸一律 mm / pt，禁止使用 px —— 针式机 360dpi 下 px 会缩放走形；
 * 3. 不设缩放，页面尺寸由 @page + 打印机纸型共同决定；
 * 4. 明细分页时每页重新打印表头，并在右上角标注「第 N 页 / 共 M 页」。
 */

export interface TicketItem {
  productName: string;
  spec?: string;
  unit?: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface TicketData {
  companyName?: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  customerPhone?: string;
  address?: string;
  items: TicketItem[];
  totalAmount: number;
  remark?: string;
  operator?: string;
}

/** 每页明细行数（14 行时版面约占 132mm，留出签字空间） */
const ROWS_PER_PAGE = 14;

const escapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c: string) => escapes[c] || c);
}

function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(digits);
}

/** 人民币大写，用于合计金额 */
export function toChineseAmount(amount: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const groups = ['', '万', '亿', '兆'];

  const value = Math.round(Math.abs(amount) * 100) / 100;
  if (value === 0) return '零元整';

  const integer = Math.floor(value);
  const cents = Math.round((value - integer) * 100);

  const intToChinese = (n: number): string => {
    if (n === 0) return '';
    let out = '';
    let groupIdx = 0;
    let zeroPending = false;
    while (n > 0) {
      const part = n % 10000;
      if (part === 0) {
        zeroPending = true;
      } else {
        let partStr = '';
        let p = part;
        let unitIdx = 0;
        while (p > 0) {
          const d = p % 10;
          if (d === 0) {
            if (partStr && !partStr.startsWith('零')) partStr = '零' + partStr;
          } else {
            partStr = digits[d] + units[unitIdx] + partStr;
          }
          p = Math.floor(p / 10);
          unitIdx += 1;
        }
        out = partStr + groups[groupIdx] + (zeroPending && out ? '零' + out : out);
        zeroPending = false;
      }
      n = Math.floor(n / 10000);
      groupIdx += 1;
    }
    return out.replace(/零+/g, '零').replace(/零$/, '');
  };

  let result = intToChinese(integer) + '元';

  if (cents === 0) {
    result += '整';
  } else {
    const jiao = Math.floor(cents / 10);
    const fen = cents % 10;
    if (jiao > 0) result += digits[jiao] + '角';
    else if (fen > 0) result += '零';
    if (fen > 0) result += digits[fen] + '分';
  }
  return result;
}

interface PageChunk {
  items: TicketItem[];
  index: number;
  total: number;
  pageAmount: number;
  pageQty: number;
}

function chunkItems(items: TicketItem[]): PageChunk[] {
  const chunks: TicketItem[][] = [];
  const safeItems = items.length > 0 ? items : [];
  if (safeItems.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < safeItems.length; i += ROWS_PER_PAGE) {
      chunks.push(safeItems.slice(i, i + ROWS_PER_PAGE));
    }
  }
  const total = chunks.length;
  return chunks.map((chunk: TicketItem[], index: number) => ({
    items: chunk,
    index,
    total,
    pageAmount: chunk.reduce((s: number, it: TicketItem) => s + (it.amount || 0), 0),
    pageQty: chunk.reduce((s: number, it: TicketItem) => s + (it.quantity || 0), 0),
  }));
}

function renderRows(items: TicketItem[], chunk: PageChunk): string {
  const rows: string[] = [];
  for (let i = 0; i < ROWS_PER_PAGE; i += 1) {
    const it = items[i];
    if (!it) {
      rows.push(
        '<tr><td class="c">' +
          String(i + 1) +
          '</td><td></td><td></td><td></td><td class="r"></td><td class="r"></td><td class="r"></td></tr>',
      );
      continue;
    }
    rows.push(
      `<tr>
        <td class="c">${i + 1}</td>
        <td class="name">${esc(it.productName)}</td>
        <td class="c">${esc(it.spec || '')}</td>
        <td class="c">${esc(it.unit || '')}</td>
        <td class="r">${num(it.quantity, 2)}</td>
        <td class="r">${num(it.price, 4)}</td>
        <td class="r">${num(it.amount)}</td>
      </tr>`,
    );
  }
  // 本页小计行占到最后一行的位置，避免空行过多
  rows.push(
    `<tr class="subtotal">
      <td class="c"></td>
      <td colspan="2" class="r">本页合计</td>
      <td></td>
      <td class="r">${num(chunk.pageQty, 2)}</td>
      <td></td>
      <td class="r">${num(chunk.pageAmount)}</td>
    </tr>`,
  );
  return rows.join('');
}

function renderCopy(data: TicketData, chunk: PageChunk, label: string): string {
  const company = esc(data.companyName || '送货单');
  const pageTip =
    chunk.total > 1
      ? `<span class="page-tip">第 ${chunk.index + 1} / ${chunk.total} 页</span>`
      : '';

  return `
  <div class="copy">
    <div class="head">
      <div class="company">${company}</div>
      <div class="title-row">
        <span class="title">送 货 单</span>
        <span class="copy-label">${label}</span>
        ${pageTip}
      </div>
    </div>

    <div class="meta">
      <span class="meta-item grow">客户：${esc(data.customerName)}</span>
      <span class="meta-item">单号：${esc(data.orderNo)}</span>
    </div>
    <div class="meta">
      <span class="meta-item grow">电话：${esc(data.customerPhone || '')}</span>
      <span class="meta-item">日期：${esc(data.orderDate)}</span>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:7mm">序号</th>
          <th>品名</th>
          <th style="width:17mm">规格</th>
          <th style="width:9mm">单位</th>
          <th style="width:15mm">数量</th>
          <th style="width:18mm">单价</th>
          <th style="width:19mm">金额</th>
        </tr>
      </thead>
      <tbody>${renderRows(chunk.items, chunk)}</tbody>
    </table>

    <div class="footer">
      <div class="sum-line">
        <span class="grow">合计金额（大写）：${esc(toChineseAmount(data.totalAmount))}</span>
        <span class="sum">¥${num(data.totalAmount)}</span>
      </div>
      <div class="sum-line">
        <span class="grow">备注：${esc(data.remark || '')}</span>
        <span>制单：${esc(data.operator || '')}</span>
      </div>
      <div class="sign-line">
        <span>收货人签字：</span>
        <span class="sign-gap"></span>
        <span>送货人：</span>
        <span class="sign-gap"></span>
      </div>
    </div>
  </div>`;
}

/**
 * 生成完整可打印 HTML。electron-hiprint 直接吃这段字符串。
 */
export function buildDeliveryTicketHtml(data: TicketData): string {
  const chunks = chunkItems(data.items || []);

  const pages = chunks
    .map(
      (chunk: PageChunk) => `
    <div class="page">
      ${renderCopy(data, chunk, '存根联')}
      ${renderCopy(data, chunk, '客户联')}
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(data.orderNo)}</title>
<style>
  @page { size: 241mm 140mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    font-family: "SimSun", "宋体", "Microsoft YaHei", monospace;
    font-size: 9pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 241mm;
    height: 140mm;
    display: flex;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .copy {
    width: 120.5mm;
    height: 140mm;
    padding: 3mm 3mm 2mm 3mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .copy:first-child { border-right: 0.4mm dashed #999; }
  .head { text-align: center; }
  .company { font-size: 9pt; letter-spacing: 0.5pt; height: 4mm; }
  .title-row { position: relative; height: 9mm; line-height: 9mm; }
  .title { font-size: 16pt; font-weight: bold; letter-spacing: 2pt; font-family: "SimHei", "黑体", "SimSun", sans-serif; }
  .copy-label {
    position: absolute; right: 0; top: 1.5mm;
    font-size: 7pt; border: 0.3mm solid #000; padding: 0 1mm; line-height: 4mm;
  }
  .page-tip { position: absolute; left: 0; top: 2mm; font-size: 7pt; }
  .meta { display: flex; font-size: 8.5pt; line-height: 5mm; }
  .meta-item { white-space: nowrap; }
  .meta-item.grow { flex: 1; overflow: hidden; text-overflow: ellipsis; }

  .items { width: 100%; border-collapse: collapse; margin-top: 1mm; table-layout: fixed; }
  .items th, .items td {
    border: 0.25mm solid #000;
    font-size: 8pt;
    line-height: 1;
    padding: 0.8mm 0.6mm;
    height: 5.6mm;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .items th { font-weight: bold; text-align: center; }
  .items td.name { text-align: left; }
  .items td.c { text-align: center; }
  .items td.r { text-align: right; }
  .items tr.subtotal td { font-weight: bold; height: 5mm; }

  .footer { margin-top: auto; padding-top: 1.5mm; font-size: 8pt; }
  .sum-line { display: flex; line-height: 5mm; align-items: baseline; }
  .sum-line .grow { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .sum { font-weight: bold; font-size: 9pt; }
  .sign-line { display: flex; align-items: baseline; line-height: 6mm; margin-top: 1mm; }
  .sign-gap { flex: 1; border-bottom: 0.25mm solid #000; margin-right: 3mm; min-width: 12mm; }
</style>
</head>
<body>${pages}</body>
</html>`;
}

/** electron-hiprint 的自定义纸张单位是 1/1000 mm */
export const TICKET_PAGE_SIZE = { width: 241 * 1000, height: 140 * 1000 };
