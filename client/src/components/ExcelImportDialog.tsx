import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Table, type TableColumnsType } from 'antd';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';

export interface ImportColumn {
  /** Excel 表头文字，同时作为默认别名 */
  header: string;
  /** 其它可识别的表头写法 */
  aliases?: string[];
  /** 映射到提交对象的字段名 */
  field: string;
  required?: boolean;
  /** 下载模板时填在第二行的示例值 */
  sample?: string;
}

export interface ImportSummary {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; name?: string; reason: string }>;
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  columns: ImportColumn[];
  templateName: string;
  onImport: (rows: Array<Record<string, unknown>>) => Promise<ImportSummary>;
  onDone?: () => void;
}

type PlainRow = Record<string, unknown>;

const norm = (s: string): string =>
  s
    .replace(/[\s\u3000]/g, '')
    .replace(/[（(]/g, '(')
    .replace(/[）)]/g, ')')
    .replace(/\*/g, '')
    .toLowerCase();

function mapRow(raw: PlainRow, columns: ImportColumn[]): PlainRow {
  const out: PlainRow = {};
  const rawKeys = Object.keys(raw);
  for (const col of columns) {
    const candidates = [col.header, ...(col.aliases ?? [])].map(norm);
    let matched: string | undefined;
    // 先精确匹配，再退化为包含匹配（兼容「单价（元）」「联系电话」这类表头）
    for (const key of rawKeys) {
      const k = norm(key);
      if (candidates.includes(k)) {
        matched = key;
        break;
      }
    }
    if (!matched) {
      for (const key of rawKeys) {
        const k = norm(key);
        if (candidates.some((c) => c.length > 1 && k.includes(c))) {
          matched = key;
          break;
        }
      }
    }
    if (matched !== undefined) out[col.field] = raw[matched];
  }
  return out;
}

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || String(v).trim() === '';

export default function ExcelImportDialog({
  open,
  onOpenChange,
  title,
  columns,
  templateName,
  onImport,
  onDone,
}: ExcelImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PlainRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const reset = (): void => {
    setFileName('');
    setRows([]);
    setParseErrors([]);
    setResult(null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (next: boolean): void => {
    if (!next) {
      const hadResult = result !== null;
      reset();
      onOpenChange(false);
      if (hadResult) onDone?.();
      return;
    }
    onOpenChange(true);
  };

  const downloadTemplate = (): void => {
    const headerRow = columns.map((c) => c.header + (c.required ? '*' : ''));
    const sampleRow = columns.map((c) => c.sample ?? '');
    const sheet = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
    sheet['!cols'] = columns.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, '数据');
    XLSX.writeFile(wb, templateName);
  };

  const handleFile = async (file: File): Promise<void> => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('文件超过 20MB，请拆分后再导入');
      return;
    }
    setResult(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        toast.error('这个文件里没有工作表');
        reset();
        return;
      }
      const raw = XLSX.utils.sheet_to_json<PlainRow>(wb.Sheets[sheetName], {
        defval: '',
        raw: false,
      });
      if (raw.length === 0) {
        toast.error('第一张工作表里没有数据行');
        reset();
        return;
      }
      const mapped = raw.map((r) => mapRow(r, columns));
      const errs: string[] = [];
      mapped.forEach((r, idx) => {
        const missing = columns.filter(
          (c) => c.required && isEmpty(r[c.field]),
        );
        if (missing.length > 0) {
          errs.push(
            `第 ${idx + 2} 行缺少「${missing.map((c) => c.header).join('、')}」`,
          );
        }
      });
      setRows(mapped);
      setParseErrors(errs);
      if (errs.length > 0) {
        toast.warning(`有 ${errs.length} 行数据不完整，已在下方标出`);
      } else {
        toast.success(`已读取 ${mapped.length} 行数据`);
      }
    } catch {
      toast.error('文件解析失败，请确认是 .xlsx / .xls 格式');
      reset();
    }
  };

  const validRows = useMemo(
    () =>
      rows.filter(
        (r) => !columns.some((c) => c.required && isEmpty(r[c.field])),
      ),
    [rows, columns],
  );

  const handleImport = async (): Promise<void> => {
    if (validRows.length === 0) {
      toast.error('没有可导入的数据');
      return;
    }
    setImporting(true);
    try {
      const res = await onImport(validRows);
      setResult(res);
      if (res.inserted > 0) {
        toast.success(`导入完成：新增 ${res.inserted} 条`);
      } else {
        toast.warning('没有新增记录，可能全部已存在');
      }
    } catch {
      toast.error('导入失败，请稍后重试');
    } finally {
      setImporting(false);
    }
  };

  const previewColumns: TableColumnsType<PlainRow> = columns.map((c) => ({
    title: c.header,
    dataIndex: c.field,
    key: c.field,
    ellipsis: true,
    width: 150,
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={downloadTemplate}>
              <Download className="w-3 h-3" />
              下载导入模板
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3 h-3" />
              选择 Excel 文件
            </Button>
            {fileName && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                {fileName}
                {rows.length > 0 && ` · 共 ${rows.length} 行`}
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          <div className="text-xs text-gray-500 leading-5">
            表头需要包含：
            {columns.map((c, i) => (
              <span key={c.field}>
                {i > 0 && '、'}
                <span className={c.required ? 'text-red-600' : ''}>
                  {c.header}
                  {c.required ? '*' : ''}
                </span>
              </span>
            ))}
            。带 * 为必填。已存在的记录会自动跳过，不会覆盖原数据。
          </div>

          {parseErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 max-h-24 overflow-auto">
              {parseErrors.slice(0, 10).map((e) => (
                <div key={e}>{e}</div>
              ))}
              {parseErrors.length > 10 && (
                <div>…… 还有 {parseErrors.length - 10} 行同类问题</div>
              )}
            </div>
          )}

          {rows.length > 0 && result === null && (
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="px-2 py-1 text-xs bg-gray-50 text-gray-600 border-b border-gray-200">
                预览（前 10 行，可导入 {validRows.length} 行）
              </div>
              <Table<PlainRow>
                columns={previewColumns}
                dataSource={rows.slice(0, 10)}
                rowKey={(_, idx) => String(idx)}
                size="small"
                pagination={false}
                scroll={{ x: true, y: 240 }}
              />
            </div>
          )}

          {result && (
            <div className="border border-gray-200 rounded p-3 text-sm space-y-1">
              <div className="font-medium text-gray-800">导入结果</div>
              <div>
                文件共 {result.total} 行：新增{' '}
                <span className="text-green-600 font-medium">{result.inserted}</span>{' '}
                条，跳过 {result.skipped} 条，失败 {result.failed} 条
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-red-600 max-h-28 overflow-auto space-y-0.5">
                  {result.errors.slice(0, 15).map((e, i) => (
                    <div key={`${e.row}-${i}`}>
                      第 {e.row} 行{e.name ? `「${e.name}」` : ''}：{e.reason}
                    </div>
                  ))}
                  {result.errors.length > 15 && (
                    <div>…… 还有 {result.errors.length - 15} 条</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
          >
            关闭
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={validRows.length === 0 || importing || result !== null}
          >
            {importing ? '导入中…' : `确认导入${validRows.length > 0 ? `（${validRows.length}）` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
