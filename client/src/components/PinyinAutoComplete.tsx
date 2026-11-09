import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

import { filterComboOptions } from '@/lib/combobox-filter';

export interface ComboOption {
  value: string;
  label?: string;
  hint?: string;
  /** 参与拼音匹配的附加字段，例如规格、电话 */
  extra?: Array<string | undefined | null>;
  /** 常用程度（越大越靠前），用于同分时的动态排序 */
  weight?: number;
  /** 选中后可取回的业务对象（例如整条商品），用于同名多规格时精确定位 */
  payload?: unknown;
}

interface PinyinAutoCompleteProps {
  value: string;
  options: ComboOption[];
  onChange: (text: string) => void;
  onSelect?: (value: string, option: ComboOption) => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  inputClassName?: string;
  style?: React.CSSProperties;
  /* 展示条数上限：默认不限，全量列出所有匹配项 */
  maxItems?: number;
  emptyText?: string;
}

interface DropdownPos {
  left: number;
  top: number;
  width: number;
}

const PinyinAutoComplete: React.FC<PinyinAutoCompleteProps> = ({
  value,
  options,
  onChange,
  onSelect,
  onFocus,
  placeholder,
  disabled = false,
  allowClear = false,
  className,
  inputClassName,
  style,
  maxItems = Number.MAX_SAFE_INTEGER,
  emptyText = '无匹配项',
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState<boolean>(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const [showAll, setShowAll] = React.useState<boolean>(false);
  const [pos, setPos] = React.useState<DropdownPos>({ left: 0, top: 0, width: 0 });

  const keyword = showAll ? '' : value || '';

  const filtered = useMemo<ComboOption[]>(
    () => filterComboOptions(options, keyword, maxItems),
    [options, keyword, maxItems]
  );

  const updatePos = useCallback((): void => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ left: rect.left, top: rect.bottom + 2, width: rect.width });
  }, []);

  const openList = useCallback(
    (listAll: boolean): void => {
      if (disabled) return;
      updatePos();
      setShowAll(listAll);
      setActiveIndex(-1);
      setOpen(true);
    },
    [disabled, updatePos],
  );

  const closeList = useCallback((): void => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectOption = useCallback(
    (opt: ComboOption): void => {
      onChange(opt.value);
      onSelect?.(opt.value, opt);
      closeList();
    },
    [closeList, onChange, onSelect],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (): void => updatePos();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      closeList();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, closeList]);

  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-combo-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        openList(false);
        setActiveIndex(filtered.length > 0 ? 0 : -1);
        return;
      }
      setActiveIndex((i: number) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openList(false);
        setActiveIndex(filtered.length - 1);
        return;
      }
      setActiveIndex((i: number) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      if (open) {
        const pick =
          activeIndex >= 0 && activeIndex < filtered.length
            ? filtered[activeIndex]
            : filtered.length === 1
              ? filtered[0]
              : undefined;
        if (pick) {
          e.preventDefault();
          selectOption(pick);
          return;
        }
      }
      closeList();
      return;
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        closeList();
      }
      return;
    }
    if (e.key === 'Tab') {
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        selectOption(filtered[activeIndex]);
      }
    }
  };

  const displayValue = value || '';

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setShowAll(false);
            setActiveIndex(-1);
            onChange(e.target.value);
            if (!open) {
              updatePos();
              setOpen(true);
            }
          }}
          onFocus={() => {
            const exact = options.some((o: ComboOption) => o.value === value);
            openList(exact);
            onFocus?.();
          }}
          onKeyDown={handleKeyDown}
          className={[
            'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none',
            'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]',
            allowClear ? 'pr-12' : 'pr-6',
            inputClassName || '',
          ].join(' ')}
        />
        {allowClear && displayValue && !disabled ? (
          <button
            type="button"
            title="清空"
            className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            onClick={() => {
              onChange('');
              closeList();
              inputRef.current?.focus();
            }}
          >
            <X size={12} />
          </button>
        ) : null}
        <button
          type="button"
          title="展开列表"
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 disabled:opacity-40"
          onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
          onClick={() => {
            if (open) {
              closeList();
              return;
            }
            openList(true);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && !disabled && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            width: Math.max(pos.width, 160),
            zIndex: 9999,
          }}
          className="max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-2 text-xs text-gray-400">{emptyText}</div>
          ) : (
            filtered.map((opt: ComboOption, i: number) => (
              <div
                key={`${opt.value}-${i}`}
                data-combo-index={i}
                className={[
                  'px-2 py-1.5 cursor-pointer border-b border-gray-100 last:border-b-0',
                  i === activeIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50',
                ].join(' ')}
                onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectOption(opt)}
              >
                <div className="truncate">{opt.label || opt.value}</div>
                {opt.hint ? (
                  <div className="text-[10px] text-gray-400 truncate">{opt.hint}</div>
                ) : null}
              </div>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default PinyinAutoComplete;
