/** 日期格式化：yyyy-MM-dd */
export const fmtDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 快捷时间范围：返回 [起始日期, 结束日期]；key 见 RANGE_OPTIONS */
export function quickRange(key: string): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();
  switch (key) {
    case 'today':
      return [fmtDate(now), fmtDate(now)];
    case 'thisWeek': {
      const mondayThisWeek = new Date(y, m, day - ((now.getDay() + 6) % 7));
      return [fmtDate(mondayThisWeek), fmtDate(now)];
    }
    case 'lastWeek': {
      const mondayThisWeek = new Date(y, m, day - ((now.getDay() + 6) % 7));
      const mondayLastWeek = new Date(
        mondayThisWeek.getFullYear(),
        mondayThisWeek.getMonth(),
        mondayThisWeek.getDate() - 7
      );
      const sundayLastWeek = new Date(
        mondayThisWeek.getFullYear(),
        mondayThisWeek.getMonth(),
        mondayThisWeek.getDate() - 1
      );
      return [fmtDate(mondayLastWeek), fmtDate(sundayLastWeek)];
    }
    case 'lastMonth':
      return [fmtDate(new Date(y, m - 1, 1)), fmtDate(new Date(y, m, 0))];
    case 'thisYear':
      return [fmtDate(new Date(y, 0, 1)), fmtDate(now)];
    case 'lastYear':
      return [fmtDate(new Date(y - 1, 0, 1)), fmtDate(new Date(y - 1, 11, 31))];
    case 'month':
    default:
      return [fmtDate(new Date(y, m, 1)), fmtDate(now)];
  }
}

export const RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'month', label: '今月' },
  { value: 'thisWeek', label: '本周' },
  { value: 'today', label: '今天' },
  { value: 'lastWeek', label: '上周' },
  { value: 'lastMonth', label: '上月' },
  { value: 'thisYear', label: '今年' },
  { value: 'lastYear', label: '去年' },
];
