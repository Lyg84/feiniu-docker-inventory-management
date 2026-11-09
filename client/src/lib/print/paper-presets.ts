export type PaperKey = 'a4' | 'b5' | 'pin1' | 'pin2' | 'pin3';

export interface PaperPreset {
  key: PaperKey;
  /** 下拉里显示的名字 */
  label: string;
  widthMm: number;
  heightMm: number;
  /** 一页横向并排几联 */
  copies: number;
  copyLabels: string[];
  /** 每页明细行数 */
  rowsPerPage: number;
  /** 明细行高（mm） */
  rowHeightMm: number;
  /** 正文字号（pt） */
  fontPt: number;
  /** 标题字号（pt） */
  titlePt: number;
}

export const PAPER_PRESETS: Record<PaperKey, PaperPreset> = {
  a4: {
    key: 'a4',
    label: 'A4（210×297mm 单联）',
    widthMm: 210,
    heightMm: 297,
    copies: 1,
    copyLabels: ['客户联'],
    rowsPerPage: 26,
    rowHeightMm: 8,
    fontPt: 10.5,
    titlePt: 18,
  },
  b5: {
    key: 'b5',
    label: 'B5（176×250mm 单联）',
    widthMm: 176,
    heightMm: 250,
    copies: 1,
    copyLabels: ['客户联'],
    rowsPerPage: 21,
    rowHeightMm: 8,
    fontPt: 10,
    titlePt: 16,
  },
  pin1: {
    key: 'pin1',
    label: '针式一分纸 241×279mm（单联）',
    widthMm: 241,
    heightMm: 279,
    copies: 1,
    copyLabels: ['客户联'],
    rowsPerPage: 30,
    rowHeightMm: 5.6,
    fontPt: 9,
    titlePt: 16,
  },
  pin2: {
    key: 'pin2',
    label: '针式二分纸 241×140mm（二联）',
    widthMm: 241,
    heightMm: 140,
    copies: 2,
    copyLabels: ['存根联', '客户联'],
    rowsPerPage: 14,
    rowHeightMm: 5.6,
    fontPt: 9,
    titlePt: 16,
  },
  pin3: {
    key: 'pin3',
    label: '针式三分纸 241×93mm（三联）',
    widthMm: 241,
    heightMm: 93,
    copies: 3,
    copyLabels: ['存根联', '客户联', '财务联'],
    rowsPerPage: 7,
    rowHeightMm: 5,
    fontPt: 8,
    titlePt: 13,
  },
};

/** 系统参数里存纸型的键名 */
export const PRINT_PAPER_PARAM_KEY = 'print_paper_type';
/** 没设置时的默认纸型：针式二分纸（241×140mm 二联） */
export const DEFAULT_PAPER_KEY: PaperKey = 'pin2';

export const PAPER_OPTIONS: { value: PaperKey; label: string }[] = (
  Object.keys(PAPER_PRESETS) as PaperKey[]
).map((key: PaperKey) => ({ value: key, label: PAPER_PRESETS[key].label }));

export function normalizePaperKey(value?: string | null): PaperKey {
  const v = (value || '').trim().toLowerCase();
  if (v && (Object.keys(PAPER_PRESETS) as PaperKey[]).includes(v as PaperKey)) {
    return v as PaperKey;
  }
  return DEFAULT_PAPER_KEY;
}

export function getPaperPreset(value?: string | null): PaperPreset {
  return PAPER_PRESETS[normalizePaperKey(value)];
}

/** electron-hiprint 自定义纸张单位是 1/1000 mm */
export function paperPageSize(value?: string | null): { width: number; height: number } {
  const preset = getPaperPreset(value);
  return { width: preset.widthMm * 1000, height: preset.heightMm * 1000 };
}
