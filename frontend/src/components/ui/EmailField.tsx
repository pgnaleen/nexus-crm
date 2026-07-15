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
    <div className={displayError ? "field has-error" : "field"}>
      <label htmlFor={fieldId}>{label}</label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: "12px", color: "var(--color-text-secondary)", pointerEvents: "none" }}>
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
          style={{ paddingLeft: "36px", width: "100%" }}
          {...inputProps} 
        />
      </div>
      {displayError && <p className="field-error">{displayError}</p>}
    </div>
  );
}
