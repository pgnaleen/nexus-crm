import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, name, className, ...inputProps }: TextFieldProps) {
  const fieldId = id ?? name;

  return (
    <div className="mb-[18px]">
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        className={[
          "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-crm-text transition-colors duration-150 read-only:cursor-default read-only:bg-[var(--color-bg)] read-only:text-[var(--color-text-muted)] read-only:shadow-none focus:outline-none focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)]",
          error ? "border-[var(--color-danger)]" : "border-[var(--color-border)] focus:border-crm-primary",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...inputProps}
      />
      {error && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
