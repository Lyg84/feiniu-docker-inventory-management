import type { ComboOption } from '@client/src/components/PinyinAutoComplete';
import { pinyinScoreFields } from '@/lib/pinyin-match';

const fieldsOf = (opt: ComboOption): Array<string | undefined | null> => [
  opt.value,
  opt.label,
  opt.hint,
  ...(opt.extra || []),
];

/**
 * 关键字过滤：按匹配分数升序；同分时常用项（weight 大）在前；再同则保持原始顺序。
 * 默认全量返回，由调用方决定是否截断。
 */
export const filterComboOptions = (
  options: ComboOption[],
  keyword: string,
  maxItems: number = Number.MAX_SAFE_INTEGER
): ComboOption[] => {
  const kw = keyword.trim();
  if (!kw) {
    return options
      .slice()
      .sort((a: ComboOption, b: ComboOption) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, maxItems);
  }
  return options
    .map((opt: ComboOption, index: number) => ({
      opt,
      index,
      score: pinyinScoreFields(fieldsOf(opt), kw),
    }))
    .filter((row) => row.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score ||
        (b.opt.weight ?? 0) - (a.opt.weight ?? 0) ||
        a.index - b.index,
    )
    .slice(0, maxItems)
    .map((row) => row.opt);
};
