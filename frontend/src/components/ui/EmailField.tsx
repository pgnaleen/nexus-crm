import type { InputHTMLAttributes } from "react";
import { email } from "@/lib/validation";

interface EmailFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function EmailField({ label, error, id, name, value, onChange, ...inputProps }: EmailFieldProps) {
  const fieldId = id ?? name;
  
  // Real-time visual validation check
  const valueStr = typeof value === "string" ? value : "";
  const liveError = valueStr.length > 0 ? email()(valueStr) : undefined;
  const displayError = error || liveError;

  return (
    <div className="mb-[18px]">
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
        {label}
      </label>
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3 text-[var(--color-text-muted)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <input
          id={fieldId}
          name={name}
          type="email"
          value={value}
          onChange={onChange}
          className={`w-full rounded-lg border py-2.5 pr-3 pl-9 text-sm text-crm-text transition-colors duration-150 focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)] ${
            displayError ? "border-[var(--color-danger)]" : "border-[var(--color-border)] focus:border-crm-primary"
          }`}
          {...inputProps}
        />
      </div>
      {displayError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{displayError}</p>}
    </div>
  );
}
