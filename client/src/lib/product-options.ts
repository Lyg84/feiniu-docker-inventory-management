import type { Product } from '@shared/api.interface';
import type { ComboOption } from '@client/src/components/PinyinAutoComplete';

export const productOptionKey = (p: Product): string =>
  `${p.name}|${p.spec || ''}|${p.unit || ''}`;

export const buildProductOptions = (products: Product[]): ComboOption[] => {
  const seen = new Set<string>();
  const labelSet = new Set<string>();
  const opts: ComboOption[] = [];
  products.forEach((p: Product) => {
    const key = productOptionKey(p);
    if (seen.has(key)) return;
    seen.add(key);
    let label = p.spec ? `${p.name}（${p.spec}）` : p.name;
    if (labelSet.has(label)) label = `${label}·${p.unit || '无单位'}`;
    labelSet.add(label);
    const usage = p.usageCount ?? 0;
    const meta = [`库存 ${p.stockQty ?? 0}${p.unit || ''}`];
    if (usage > 0) meta.push(`用过 ${usage} 次`);
    if (p.category) meta.push(p.category);
    opts.push({
      value: p.name,
      label,
      hint: meta.join(' · '),
      extra: [p.spec, p.category],
      weight: usage,
      payload: p,
    });
  });
  return opts;
};
