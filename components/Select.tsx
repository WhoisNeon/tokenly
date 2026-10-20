'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption = { value: string; label: string; icon?: ReactNode };

/**
 * Replaces a native <select>. Keyboard: ArrowUp/Down move (and open),
 * Home/End jump, Enter/Space commit, Escape closes, Tab closes.
 * Closes on outside pointerdown.
 */
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (open) setHighlight(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Move DOM focus with the highlight so screen readers follow the selection.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelectorAll<HTMLLIElement>('[role="option"]')[highlight]?.focus();
  }, [open, highlight]);

  const commit = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  const step = (delta: number) => {
    if (!open) {
      setOpen(true);
      return;
    }
    setHighlight((index) => (index + delta + options.length) % options.length);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        step(-1);
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          setHighlight(0);
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          setHighlight(options.length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) commit(highlight);
        else setOpen(true);
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className="select" ref={root} onKeyDown={onKeyDown}>
      {/* One button for the whole control, icon included — clicking the icon
          must open the menu, not just the text. */}
      <button
        ref={trigger}
        type="button"
        className="select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((previous) => !previous)}
      >
        {selected?.icon && <span className="select__lead">{selected.icon}</span>}
        <span className="select__value">{selected?.label}</span>
        <ChevronDown className="select__caret" size={14} aria-hidden="true" data-open={open} />
      </button>

      <ul
        id={listId}
        ref={list}
        role="listbox"
        aria-label={label}
        className="select__list"
        data-open={open}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            tabIndex={-1}
            className="select__option"
            data-active={index === highlight}
            onClick={() => commit(index)}
            onMouseEnter={() => setHighlight(index)}
          >
            {option.icon && <span className="select__lead">{option.icon}</span>}
            <span className="select__label">{option.label}</span>
            <span className="select__check" aria-hidden="true">
              {option.value === value && <Check size={13} strokeWidth={3} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
