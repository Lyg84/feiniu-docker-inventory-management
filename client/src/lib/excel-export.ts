import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  /** Excel 表头 */
  header: string;
  /** 取单元格内容 */
  value: (row: T) => string | number | null | undefined;
  /** 列宽（字符数，默认按表头长度估算） */
  width?: number;
  /** 数字列：按两位小数写进单元格，Excel 里能直接求和 */
  numeric?: boolean;
}

export interface ExportOptions<T> {
  /** 文件名，不用带扩展名 */
  fileName: string;
  /** 工作表名 */
  sheetName: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** 首行大标题（可选），会横向合并 */
  title?: string;
  /** 末行备注（可选），如「导出时间 / 导出人」 */
  note?: string;
}

const toCell = <T,>(col: ExportColumn<T>, row: T): string | number => {
  const raw = col.value(row);
  if (raw === null || raw === undefined || raw === '') return '';
  if (col.numeric) {
    const n = typeof raw === 'number' ? raw : Number(String(raw));
    return Number.isFinite(n) ? n : '';
  }
  return raw;
};

/** 导出为 .xlsx 并触发浏览器下载 */
export function exportToExcel<T>(options: ExportOptions<T>): void {
  const { fileName, sheetName, columns, rows, title, note } = options;
  const aoa: Array<Array<string | number>> = [];

  if (title) aoa.push([title]);
  aoa.push(columns.map((c: ExportColumn<T>) => c.header));
  rows.forEach((row: T) => {
    aoa.push(columns.map((c: ExportColumn<T>) => toCell(c, row)));
  });
  if (note) {
    aoa.push([]);
    aoa.push([note]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // 列宽：优先用配置，否则按表头字数估
  sheet['!cols'] = columns.map((c: ExportColumn<T>) => ({
    wch: c.width ?? Math.max(10, c.header.length * 2.2),
  }));

  const merges: XLSX.Range[] = [];
  if (title) {
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columns.length - 1) } });
  }
  if (note) {
    merges.push({
      s: { r: aoa.length - 1, c: 0 },
      e: { r: aoa.length - 1, c: Math.max(0, columns.length - 1) },
    });
  }
  if (merges.length > 0) sheet['!merges'] = merges;

  // 数字列两位小数
  columns.forEach((col: ExportColumn<T>, idx: number) => {
    if (!col.numeric) return;
    const startRow = title ? 2 : 1;
    for (let r = startRow; r < startRow + rows.length; r += 1) {
      const addr = XLSX.utils.encode_cell({ r, c: idx });
      const cell = sheet[addr];
      if (cell && typeof cell.v === 'number') cell.z = '0.00';
    }
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, `${fileName}.xlsx`, { compression: true });
}

/** 今天的 yyyymmdd，用于文件名 */
export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 按页把所有数据拉全，用于「导出全部查询结果」。
 * fetchPage 返回 { items, total }，pageSize 由调用方给（后端一般封顶 100）。
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 100,
  maxRows = 20000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (all.length < maxRows) {
    const res = await fetchPage(page, pageSize);
    const items = res?.items ?? [];
    all.push(...items);
    if (items.length === 0) break;
    if (all.length >= (res?.total ?? 0)) break;
    page += 1;
    if (page > 500) break;
  }
  return all.slice(0, maxRows);
}
