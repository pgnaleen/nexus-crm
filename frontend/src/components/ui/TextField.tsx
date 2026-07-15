import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, name, ...inputProps }: TextFieldProps) {
  const fieldId = id ?? name;

  return (
    <div className={error ? "field has-error" : "field"}>
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} name={name} {...inputProps} />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
