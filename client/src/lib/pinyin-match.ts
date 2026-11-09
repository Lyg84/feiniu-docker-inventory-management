import { pinyin } from 'pinyin-pro';

interface Token {
  lower: string;
  /** 全拼，音节直接相连：硒鼓 -> xigu */
  full: string;
  /** 首字母：硒鼓（兄弟2890） -> xg（xd2 */
  initials: string;
  /** 逐音节数组，非汉字段整段作一个元素：['xi','gu','xiong','di','2890'] */
  syllables: string[];
}

const cache = new Map<string, Token>();
const CJK_RE = /[\u4e00-\u9fff]/;

function tokenize(text: string): Token {
  const raw = text || '';
  const cached = cache.get(raw);
  if (cached) return cached;

  const lower = raw.toLowerCase();
  let syllables: string[] = [];
  let full = '';
  let initials = '';

  try {
    syllables = (pinyin(raw, {
      toneType: 'none',
      type: 'array',
      nonZh: 'consecutive',
    }) as string[])
      .map((s) => (s || '').toLowerCase())
      .filter((s) => Boolean(s));
    full = syllables.join('');
    initials = syllables.map((s) => s[0]).join('');
  } catch {
    syllables = lower ? [lower] : [];
    full = lower;
    initials = lower;
  }

  const token: Token = { lower, full, initials, syllables };
  cache.set(raw, token);
  return token;
}

/**
 * 关键字能否从某个音节边界起、按整音节拼出来。
 * 逐音节累计，只有恰好等于关键字才算命中，因此不会跨音节截取子串
 * （例如 "dingshuji" 里的 "gs" 不算命中）。
 */
function syllableAligned(syllables: string[], kw: string): boolean {
  for (let i = 0; i < syllables.length; i += 1) {
    let acc = '';
    for (let j = i; j < syllables.length; j += 1) {
      acc += syllables[j];
      if (acc === kw) return true;
      if (!kw.startsWith(acc)) break;
    }
  }
  return false;
}

/**
 * 匹配等级：0 最靠前，数值越大越靠后；-1 表示不命中。
 * 0 原文前缀 / 1 全拼前缀 / 2 首字母前缀 / 3 原文包含 / 4 全拼音节对齐 / 5 首字母包含
 * 关键字含汉字时才额外转拼音后比对。
 */
export function pinyinScore(text: string, keyword: string): number {
  const kw = (keyword || '').trim().toLowerCase();
  if (!kw) return 0;

  const target = tokenize(text);

  if (target.lower.startsWith(kw)) return 0;
  if (target.full.startsWith(kw)) return 1;
  if (target.initials.startsWith(kw)) return 2;
  if (target.lower.includes(kw)) return 3;
  if (syllableAligned(target.syllables, kw)) return 4;

  if (CJK_RE.test(kw)) {
    const kwToken = tokenize(kw);
    if (kwToken.syllables.length > 0 && syllableAligned(target.syllables, kwToken.full)) return 4;
    if (kwToken.initials && target.initials.includes(kwToken.initials)) return 5;
  } else if (kw.length > 1 && target.initials.includes(kw)) {
    return 5;
  }

  return -1;
}

export function pinyinIncludes(text: string, keyword: string): boolean {
  return pinyinScore(text, keyword) >= 0;
}

/** 多字段匹配：取各字段里最好的等级，全不命中返回 -1 */
export function pinyinScoreFields(
  fields: Array<string | undefined | null>,
  keyword: string,
): number {
  const kw = (keyword || '').trim();
  if (!kw) return 0;

  let best = -1;
  for (const f of fields) {
    if (!f) continue;
    const score = pinyinScore(String(f), kw);
    if (score >= 0 && (best < 0 || score < best)) best = score;
  }
  return best;
}

/** 多字段匹配：任意字段命中即可 */
export function pinyinMatchFields(
  fields: Array<string | undefined | null>,
  keyword: string,
): boolean {
  return pinyinScoreFields(fields, keyword) >= 0;
}

/**
 * 列表关键字过滤：命中项按匹配等级升序返回，等级相同保持原有顺序。
 * 用于资料类列表的拼音搜索（服务端只按原文 like，拼音得在客户端过滤）。
 */
export function filterByPinyin<T>(
  rows: T[],
  keyword: string,
  fieldsOf: (row: T) => Array<string | undefined | null>,
): T[] {
  const kw = (keyword || '').trim();
  if (!kw) return rows;
  return rows
    .map((row, index) => ({ row, index, score: pinyinScoreFields(fieldsOf(row), kw) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((r) => r.row);
}
