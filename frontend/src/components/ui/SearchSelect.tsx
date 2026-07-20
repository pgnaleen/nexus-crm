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
    <div className="search-select-wrapper" ref={ref}>
      {label && <label className="field-label">{label}</label>}
      <button
        type="button"
        className={`search-select-trigger${isOpen ? " is-open" : ""}`}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={`search-select-value${!selected ? " is-placeholder" : ""}`}>
          {selected ? (
            <>
              {selected.icon}
              {selected.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDownIcon size={14} />
      </button>

      {isOpen && !disabled && (
        <div className="search-select-menu">
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
