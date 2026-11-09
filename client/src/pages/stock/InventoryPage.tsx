import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Search, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { inventoryApi, warehouseApi } from '@client/src/api';
import type { Product, Warehouse } from '@shared/api.interface';
import PinyinSelect from '@client/src/components/PinyinSelect';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { buildWarehouseOptions } from '@/lib/entity-options';
import { filterByPinyin } from '@/lib/pinyin-match';
import { exportToExcel, todayStamp } from '@/lib/excel-export';

export default function InventoryPage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [searchWarehouseId, setSearchWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [exporting, setExporting] = useState(false);

  const warehouseOptions = useMemo<ComboOption[]>(
    () => buildWarehouseOptions(warehouses),
    [warehouses]
  );

  /** 关键字按拼音过滤：服务端只认原文，拼音得把该仓库的整份存货拉回来在本地筛 */
  const fetchData = useCallback(
    async (p = page, kw = searchKw, whId = searchWarehouseId) => {
      setLoading(true);
      try {
        if (!kw) {
          const res = await inventoryApi.list({
            page: p,
            pageSize,
            keyword: '',
            warehouseId: whId,
          });
          setList(res.items);
          setTotal(res.total);
          setPage(res.page);
          return;
        }
        const res = await inventoryApi.list({
          page: 1,
          pageSize: 100000,
          keyword: '',
          warehouseId: whId,
        });
        const rows = filterByPinyin(res.items, kw, (r: Product) => [
          r.name,
          r.spec,
          r.unit,
          r.category,
          r.remark,
        ]);
        setTotal(rows.length);
        setPage(p);
        setList(rows.slice((p - 1) * pageSize, p * pageSize));
      } finally {
        setLoading(false);
      }
    },
    [pageSize, searchKw, searchWarehouseId],
  );

  useEffect(() => {
    fetchData(1, searchKw, searchWarehouseId);
  }, [searchKw, searchWarehouseId]);

  useEffect(() => {
    warehouseApi.all().then((res) => setWarehouses(res));
  }, []);

  const handleSearch = () => {
    setSearchKw(keyword.trim());
    setSearchWarehouseId(warehouseId);
    setPage(1);
  };

  const handleRefresh = () => {
    fetchData(page, searchKw, searchWarehouseId);
  };

  /** 导出当前查询下的全部存货（不只是当前页） */
  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await inventoryApi.list({
        page: 1,
        pageSize: 100000,
        keyword: '',
        warehouseId: searchWarehouseId,
      });
      let rows = res.items;
      if (searchKw) {
        rows = filterByPinyin(rows, searchKw, (r: Product) => [
          r.name,
          r.spec,
          r.unit,
          r.category,
          r.remark,
        ]);
      }
      if (rows.length === 0) {
        toast.error('当前条件下没有可导出的存货');
        return;
      }
      exportToExcel<Product>({
        fileName: `库存查询_${todayStamp()}`,
        sheetName: '库存',
        rows,
        columns: [
          { header: '商品名称', value: (r: Product) => r.name, width: 24 },
          { header: '规格', value: (r: Product) => r.spec ?? '', width: 16 },
          { header: '单位', value: (r: Product) => r.unit ?? '', width: 8 },
          { header: '单价', value: (r: Product) => r.price, numeric: true, width: 12 },
          { header: '库存数量', value: (r: Product) => r.stockQty, numeric: true, width: 12 },
          {
            header: '库存金额',
            value: (r: Product) => (r.price || 0) * (r.stockQty || 0),
            numeric: true,
            width: 14,
          },
          { header: '类别', value: (r: Product) => r.category ?? '', width: 14 },
          { header: '备注', value: (r: Product) => r.remark ?? '', width: 24 },
        ],
        note: `导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`,
      });
      toast.success('已导出 Excel');
    } catch {
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const totalAmount = useMemo(
    () =>
      list.reduce(
        (sum: number, item: Product) => sum + (item.price || 0) * (item.stockQty || 0),
        0,
      ),
    [list],
  );

  const columns: TableColumnsType<Product> = [
    { title: '商品名称', dataIndex: 'name', width: 200, fixed: 'left' },
    { title: '规格', dataIndex: 'spec', width: 140 },
    { title: '单位', dataIndex: 'unit', width: 80 },
    {
      title: '单价',
      dataIndex: 'price',
      width: 100,
      align: 'right',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: '库存数量',
      dataIndex: 'stockQty',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <span className={v <= 0 ? 'text-red-600' : ''}>{v?.toFixed(2)}</span>
      ),
    },
    {
      title: '库存金额',
      key: 'stockAmount',
      width: 120,
      align: 'right',
      render: (_: unknown, record: Product) =>
        ((record.price || 0) * (record.stockQty || 0)).toFixed(2),
    },
    { title: '类别', dataIndex: 'category', width: 120 },
    { title: '备注', dataIndex: 'remark', width: 200, ellipsis: true },
  ];

  return (
    <div className="bg-white rounded border border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-gray-800">存货查询</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <PinyinSelect
              value={warehouseId}
              options={warehouseOptions}
              onChange={setWarehouseId}
              placeholder="全部仓库"
              className="h-8 w-36"
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="商品名称/拼音"
              className="w-48 h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" variant="default" onClick={handleSearch}>
              <Search className="w-3 h-3" />
              搜索
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />
            刷新
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="w-3 h-3" />
            {exporting ? '导出中…' : '导出 Excel'}
          </Button>
        </div>
      </div>
      <Table<Product>
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200, y: 500 }}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            fetchData(p, searchKw, searchWarehouseId);
          },
        }}
      />
      <div className="p-3 border-t border-gray-200 flex justify-end text-sm bg-gray-50">
        <span className="text-gray-500">当前页库存总金额：</span>
        <span className="font-semibold text-blue-700 ml-1">¥ {totalAmount.toFixed(2)}</span>
      </div>
    </div>
  );
}
