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
  // In filter-bar mode, the first option is always the "All …" default. A non-default selection is highlighted.
  const isFiltered = value !== "" && value !== (options[0]?.value ?? "");

  return (
    <div className="relative" ref={ref} style={fullWidth ? { width: "100%" } : undefined}>
      <button
        type="button"
        className={
          fullWidth
            ? // ── Form-field variant (inside dialogs) ──────────────────────────────
              `flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm text-crm-text transition-[border-color,box-shadow] duration-150 outline-none cursor-pointer ${
                isOpen
                  ? "border-crm-primary shadow-[0_0_0_3px_var(--color-crm-primary-glow)]"
                  : "border-[var(--color-border)] hover:border-crm-primary"
              } ${disabled ? "opacity-60 cursor-default" : ""}`
            : // ── Filter-bar variant (Funnel board toolbar) ─────────────────────────
              `flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-[13px] text-slate-700 transition-[border-color,box-shadow] duration-150 outline-none cursor-pointer select-none whitespace-nowrap ${
                isOpen
                  ? "border-crm-primary shadow-[0_0_0_3px_var(--color-crm-primary-glow)]"
                  : isFiltered
                    ? "border-crm-primary/60 bg-sky-50/60 text-crm-primary"
                    : "border-[var(--color-border)] hover:border-slate-400"
              } ${disabled ? "opacity-60 cursor-default" : ""}`
        }
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {fullWidth ? (
          // Form-field: no label pill, just selected value + chevron
          <span className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate text-left" style={{ fontWeight: 400, color: value === "" ? "var(--color-text-muted)" : undefined }}>
              {selectedLabel}
            </span>
            <svg className="shrink-0 text-slate-400 ml-2" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </span>
        ) : (
          // Filter-bar: show muted label prefix + bold selected value + chevron
          <>
            {label && (
              <span className="text-[12px] font-medium text-slate-400 after:content-[':'] after:ml-px">
                {label}
              </span>
            )}
            <span className={`font-semibold text-[12.5px] ${isFiltered ? "text-crm-primary" : "text-slate-700"}`}>
              {selectedLabel}
            </span>
            <svg className={`shrink-0 ml-0.5 ${isFiltered ? "text-crm-primary" : "text-slate-400"}`} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </>
        )}
      </button>

      {isOpen && !disabled && (
        <div className={
          fullWidth
            ? "absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl p-1.5 shadow-lg z-50 max-h-[240px] overflow-y-auto"
            : "absolute top-[calc(100%+4px)] left-0 min-w-full bg-white border border-slate-200 rounded-xl p-1.5 shadow-lg z-50"
        }>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`block w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors duration-100 border-none bg-transparent cursor-pointer ${
                value === opt.value || (!value && opt.value === options[0]?.value)
                  ? "bg-slate-50 text-crm-primary font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
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

