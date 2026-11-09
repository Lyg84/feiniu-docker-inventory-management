import type {
  Customer,
  Supplier,
  Product,
  Warehouse,
  FinanceItem,
} from '@shared/api.interface';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';

/** 客户下拉：value 是客户 id，输入框显示客户名称，联系人和电话一起参与拼音匹配 */
export const buildCustomerOptions = (list: Customer[]): ComboOption[] =>
  list.map((c: Customer) => ({
    value: c.id,
    label: c.name,
    hint: [c.contactPerson, c.phone].filter(Boolean).join(' · ') || c.address || '',
    extra: [c.contactPerson, c.phone, c.address],
    searchFields: [c.name, c.contactPerson, c.phone, c.address],
  }));

export const buildSupplierOptions = (list: Supplier[]): ComboOption[] =>
  list.map((s: Supplier) => ({
    value: s.id,
    label: s.name,
    hint: [s.contactPerson, s.phone].filter(Boolean).join(' · ') || s.address || '',
    extra: [s.contactPerson, s.phone, s.address],
    searchFields: [s.name, s.contactPerson, s.phone, s.address],
  }));

export const buildWarehouseOptions = (list: Warehouse[]): ComboOption[] =>
  list.map((w: Warehouse) => ({
    value: w.id,
    label: w.name,
    hint: [w.manager, w.address].filter(Boolean).join(' · '),
    extra: [w.manager, w.address],
    searchFields: [w.name, w.manager, w.address],
  }));

/** 财务项目按收支类型分开供选择，避免收入单里混进支出项目 */
export const buildFinanceItemOptions = (list: FinanceItem[]): ComboOption[] =>
  list.map((it: FinanceItem) => ({
    value: it.id,
    label: it.name,
    extra: [it.remark],
    searchFields: [it.name, it.remark],
  }));

/**
 * 商品下拉（按 id 取值）：同名不同规格各占一条，显示文本重名时补单位区分。
 * 库存、分类、规格、单位都参与拼音匹配。
 */
export const buildProductIdOptions = (products: Product[]): ComboOption[] => {
  const labelSet = new Set<string>();
  return products.map((p: Product) => {
    let label = p.spec ? `${p.name}（${p.spec}）` : p.name;
    if (labelSet.has(label)) label = `${label}·${p.unit || '无单位'}`;
    labelSet.add(label);
    const meta = [`库存 ${p.stockQty ?? 0}${p.unit || ''}`];
    if (p.category) meta.push(p.category);
    return {
      value: p.id,
      label,
      hint: meta.join(' · '),
      extra: [p.spec, p.unit, p.category, p.remark],
      searchFields: [p.name, p.spec, p.unit, p.category, p.remark],
      weight: p.usageCount ?? 0,
      payload: p,
    };
  });
};
