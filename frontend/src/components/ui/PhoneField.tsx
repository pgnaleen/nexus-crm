"use client";

import { type InputHTMLAttributes } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface PhoneFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

export function PhoneField({ label, error, id, name, value, onChange, ...inputProps }: PhoneFieldProps) {
  const fieldId = id ?? name;

  return (
    <div className={error ? "field has-error" : "field"}>
      <label htmlFor={fieldId}>{label}</label>
      <div 
        className="phone-field-wrapper"
        style={{
          border: error ? "1px solid var(--color-error)" : "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          backgroundColor: "var(--color-bg)",
          padding: "10px 12px",
          transition: "border-color 0.2s"
        }}
      >
        <PhoneInput
          international
          defaultCountry="US"
          id={fieldId}
          name={name}
          value={value}
          onChange={(val) => onChange(val || "")}
          className="custom-phone-input"
          limitMaxLength={true}
          {...(inputProps as any)}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      
      <style>{`
        /* Override react-phone-number-input default styles to match our premium theme */
        .custom-phone-input {
          display: flex;
          align-items: center;
        }
        .custom-phone-input .PhoneInputCountry {
          margin-right: 12px;
          padding-right: 12px;
          border-right: 1px solid var(--color-border);
        }
        .custom-phone-input .PhoneInputCountrySelectArrow {
          margin-left: 6px;
          width: 0.4em;
          height: 0.4em;
          border-right: 2px solid var(--color-text-secondary);
          border-bottom: 2px solid var(--color-text-secondary);
        }
        .custom-phone-input .PhoneInputInput {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
          color: var(--color-text);
          padding: 0; /* Remove double padding applied by global input styles */
          height: auto;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
