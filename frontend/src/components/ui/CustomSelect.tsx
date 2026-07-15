"use client";

import { useState, useRef, useEffect } from "react";

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

export function CustomSelect({ label, value, onChange, options }: CustomSelectProps) {
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
    <div className="funnel-custom-select-wrapper" ref={ref}>
      <button 
        type="button" 
        className={`funnel-filter-group ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="funnel-filter-label">{label}</span>
        <span className="funnel-custom-select-value">
          {selectedLabel}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </span>
      </button>
      
      {isOpen && (
        <div className="funnel-custom-select-menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`funnel-custom-select-option ${value === opt.value ? "is-selected" : ""}`}
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
