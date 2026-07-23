"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export function PasswordField({ label, error, id, name, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? name;

  return (
    <div className="mb-[18px]">
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          className={`w-full rounded-lg border py-2.5 pr-[42px] pl-3 text-sm text-crm-text transition-colors duration-150 focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,28,45,0.15)] ${
            error ? "border-[var(--color-danger)]" : "border-[var(--color-border)] focus:border-crm-primary"
          }`}
          {...inputProps}
        />
        <button
          type="button"
          className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center justify-center rounded-md border-none bg-none p-1.5 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#f3f4f6] hover:text-crm-text"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.75 21.75 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
