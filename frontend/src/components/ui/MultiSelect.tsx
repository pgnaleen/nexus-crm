"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "./icons";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
}

interface MultiSelectProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  addNewLabel?: string;
  onAddNew?: () => void;
  // Read-only rendering: chips still show, but the menu can't open and the
  // per-chip remove buttons disappear. Added so view-mode dialogs can reuse
  // this component directly instead of falling back to .field-locked-value.
  disabled?: boolean;
}

export function MultiSelect({
  label,
  values,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  addNewLabel,
  onAddNew,
  disabled = false,
}: MultiSelectProps) {
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

  function toggleOption(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  function removeOption(e: React.MouseEvent, value: string) {
    e.stopPropagation(); // prevent opening dropdown when removing a chip
    onChange(values.filter((v) => v !== value));
  }

  const selectedOptions = options.filter((o) => values.includes(o.value));

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  return (
    <div className="multi-select-wrapper" ref={ref}>
      {label && <label className="field-label">{label}</label>}
      <div
        className={`multi-select-trigger ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-disabled={disabled || undefined}
      >
        <div className="multi-select-chips">
          {selectedOptions.length === 0 ? (
            <span className="multi-select-placeholder">{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <span key={opt.value} className="multi-select-chip">
                {opt.icon}
                {opt.label}
                {!disabled && (
                  <button
                    type="button"
                    className="multi-select-chip-remove"
                    onClick={(e) => removeOption(e, opt.value)}
                    aria-label={`Remove ${opt.label}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <div className="multi-select-indicator">
          <ChevronDownIcon size={14} />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="multi-select-menu">
          <div className="search-select-search-box" onClick={(e) => e.stopPropagation()}>
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
            {filteredOptions.length === 0 ? (
              <div className="multi-select-empty">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`multi-select-option ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleOption(opt.value)}
                  >
                    <div className="multi-select-checkbox">
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      )}
                    </div>
                    {opt.icon}
                    <span className="search-select-option-text">
                      {opt.label}
                      {opt.sublabel && <span className="search-select-option-sublabel">{opt.sublabel}</span>}
                    </span>
                  </button>
                );
              })
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
