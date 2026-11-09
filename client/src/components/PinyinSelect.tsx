import React, { useEffect, useMemo, useState } from 'react';

import PinyinAutoComplete, { type ComboOption } from '@client/src/components/PinyinAutoComplete';

interface PinyinSelectProps {
  /** 当前选中的记录 id，空串表示未选 */
  value: string;
  /** value 是 id、label 是显示名；extra 里的规格/电话等同样参与拼音匹配 */
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * 按 id 取值的拼音输入选择框。
 * 输入框里显示的是名称，选中后回调 id，便于沿用各处表单的 customerId/supplierId/productId 字段。
 */
const PinyinSelect: React.FC<PinyinSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  allowClear = true,
  className,
  inputClassName,
}) => {
  const selectedLabel = useMemo<string>(
    () => options.find((o: ComboOption) => o.value === value)?.label || '',
    [options, value],
  );

  const [text, setText] = useState<string>(selectedLabel);

  // id 被外部改动（打开编辑、清空、基础资料异步加载完成）时，输入框跟着回显
  useEffect(() => {
    setText(selectedLabel);
  }, [selectedLabel]);

  const handleTextChange = (next: string): void => {
    setText(next);
    if (!next) onChange('');
  };

  const handleSelect = (id: string, option: ComboOption): void => {
    onChange(id);
    setText(option.label || option.value);
  };

  /** 失焦时：输全了名称就直接认领这条记录，否则回滚到已选项，不让半截关键字留在框里 */
  const handleBlur = (): void => {
    const typed = text.trim();
    if (!typed) {
      if (value) onChange('');
      return;
    }
    const exact = options.find((o: ComboOption) => (o.label || o.value) === typed);
    if (exact) {
      if (exact.value !== value) onChange(exact.value);
      setText(exact.label || exact.value);
      return;
    }
    setText(selectedLabel);
  };

  return (
    <PinyinAutoComplete
      value={text}
      options={options}
      onChange={handleTextChange}
      onSelect={handleSelect}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      className={className}
      inputClassName={inputClassName}
    />
  );
};

export default PinyinSelect;
