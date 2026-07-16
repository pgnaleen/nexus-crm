"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "./icons";

interface MultiSelectProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function MultiSelect({ label, values, onChange, options, placeholder = "Select..." }: MultiSelectProps) {
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

  return (
    <div className="multi-select-wrapper" ref={ref}>
      {label && <label className="field-label">{label}</label>}
      <div 
        className={`multi-select-trigger ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="multi-select-chips">
          {selectedOptions.length === 0 ? (
            <span className="multi-select-placeholder">{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <span key={opt.value} className="multi-select-chip">
                {opt.label}
                <button
                  type="button"
                  className="multi-select-chip-remove"
                  onClick={(e) => removeOption(e, opt.value)}
                  aria-label={`Remove ${opt.label}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </span>
            ))
          )}
        </div>
        <div className="multi-select-indicator">
          <ChevronDownIcon size={14} />
        </div>
      </div>
      
      {isOpen && (
        <div className="multi-select-menu">
          {options.length === 0 ? (
            <div className="multi-select-empty">No options available</div>
          ) : (
            options.map((opt) => {
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
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
