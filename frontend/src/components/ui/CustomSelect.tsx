"use client";

import { useState, useRef, useEffect } from "react";

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
  disabled?: boolean;
}

export function CustomSelect({ label, value, onChange, options, fullWidth, disabled }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || options[0]?.label || "";

  return (
    <div className="relative" ref={ref} style={fullWidth ? { width: "100%" } : undefined}>
      <button
        type="button"
        className={fullWidth
          ? `flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm text-crm-text transition-[border-color,box-shadow] duration-150 outline-none cursor-pointer ${
              isOpen
                ? "border-crm-primary shadow-[0_0_0_3px_var(--color-crm-primary-glow)]"
                : "border-[var(--color-border)] hover:border-crm-primary"
            } ${disabled ? "opacity-60 cursor-default" : ""}`
          : `funnel-filter-group ${isOpen ? "is-open" : ""}`
        }
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={!fullWidth && disabled ? { opacity: 0.6, cursor: "default" } : undefined}
      >
        {label && <span className="funnel-filter-label">{label}</span>}
        <span
          className={fullWidth ? "flex-1 flex items-center justify-between min-w-0" : "funnel-custom-select-value"}
          style={fullWidth ? { width: "100%", fontWeight: 400, color: value === "" ? "var(--color-text-muted)" : undefined } : (value === "" ? { color: "var(--color-text-muted)" } : undefined)}
        >
          {fullWidth ? (
            <>
              <span className="truncate text-left">{selectedLabel}</span>
              <svg className="shrink-0 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </>
          ) : (
            <>
              {selectedLabel}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </>
          )}
        </span>
      </button>

      {isOpen && !disabled && (
        <div className={fullWidth 
          ? "absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl p-1.5 shadow-lg z-50 max-h-[240px] overflow-y-auto"
          : "funnel-custom-select-menu"
        }>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={fullWidth
                ? `block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 border-none bg-transparent cursor-pointer ${
                    value === opt.value
                      ? "bg-slate-50 text-crm-text font-bold"
                      : "text-slate-600 hover:bg-slate-50/70 hover:text-slate-800"
                  }`
                : `funnel-custom-select-option ${value === opt.value ? "is-selected" : ""}`
              }
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
