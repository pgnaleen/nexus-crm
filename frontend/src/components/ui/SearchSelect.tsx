"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "./icons";

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
}

interface SearchSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  addNewLabel?: string;
  onAddNew?: () => void;
  disabled?: boolean;
  // Filter-bar sizing (matches the search input / CustomSelect at py-2 /
  // 13px) -- the default stays the taller form-field size used in dialogs.
  compact?: boolean;
  variant?: "default" | "pill";
}

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyLabel = "No results found",
  addNewLabel,
  onAddNew,
  disabled,
  compact,
  variant = "default",
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  function selectOption(opt: SearchSelectOption) {
    onChange(opt.value);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      {label && <label className="field-label">{label}</label>}
      <button
        type="button"
        className={
          variant === "pill"
            ? `flex items-center justify-between gap-2 rounded-full border px-3 text-slate-700 font-bold transition-all duration-200 h-8 ${
                isOpen ? "border-crm-primary shadow-[0_2px_8px_rgba(230,57,70,0.12)]" : "border-slate-200 hover:border-crm-primary hover:shadow-[0_2px_8px_rgba(230,57,70,0.12)] hover:bg-slate-50"
              } disabled:cursor-default disabled:opacity-60`
            : `flex w-full items-center justify-between gap-2 rounded-lg border px-3 text-crm-text transition-colors duration-150 disabled:cursor-default disabled:opacity-60 ${
                compact ? "bg-white py-2 text-[13px]" : "py-2.5 text-sm"
              } ${
                isOpen ? "border-crm-primary" : "border-[var(--color-border)] hover:border-crm-primary"
              }`
        }
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
      >
        <span
          className={`flex-1 flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap text-left ${
            !selected && variant !== "pill" ? "text-[var(--color-text-muted)]" : ""
          }`}
        >
          {selected ? (
            <>
              {selected.icon}
              {selected.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-md border-none bg-transparent p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              aria-label="Clear selection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
          <span className="flex-shrink-0 text-[var(--color-text-muted)]">
            <ChevronDownIcon size={14} />
          </span>
        </div>
      </button>

      {isOpen && !disabled && (
        <div className={`search-select-menu ${variant === "pill" ? "!w-[280px] !left-auto right-0" : ""}`}>
          <div className="search-select-search-box">
            <SearchIcon size={14} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="search-select-options">
            {filtered.length === 0 ? (
              <div className="search-select-empty">{emptyLabel}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`search-select-option${value === opt.value ? " is-selected" : ""}`}
                  onClick={() => selectOption(opt)}
                >
                  {opt.icon}
                  <span className="search-select-option-text">
                    {opt.label}
                    {opt.sublabel && <span className="search-select-option-sublabel">{opt.sublabel}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
          {onAddNew && (
            <button
              type="button"
              className="search-select-add-new"
              onClick={() => {
                setIsOpen(false);
                setQuery("");
                onAddNew();
              }}
            >
              <PlusIcon size={14} /> {addNewLabel ?? "Add new"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
