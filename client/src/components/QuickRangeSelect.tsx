import type { FC } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { RANGE_OPTIONS } from '@/lib/quick-range';

interface QuickRangeSelectProps {
  /** 当前选中的快捷范围 key，空串表示自定义 */
  value: string;
  onChange: (key: string) => void;
  /** 触发器宽度，默认 w-24 */
  className?: string;
}

/** 快捷时间下拉：选中后由调用方回填起止日期 */
const QuickRangeSelect: FC<QuickRangeSelectProps> = ({ value, onChange, className }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger size="sm" className={className ?? 'w-24'}>
      <SelectValue placeholder="自定义" />
    </SelectTrigger>
    <SelectContent>
      {RANGE_OPTIONS.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default QuickRangeSelect;
