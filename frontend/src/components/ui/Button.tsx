import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary";
}

// Base is intentionally auto-width (not full-width) -- that's how this component is used almost
// everywhere (dialog footers), matching what the old .dialog-actions .btn override used to force.
// The two standalone full-width consumers (LoginForm, BackupsWidget) pass their own `w-full`.
const BASE =
  "rounded-lg px-[18px] py-2.5 text-sm font-semibold cursor-pointer transition-[background,opacity] duration-150 disabled:cursor-default disabled:opacity-60";
const VARIANT_CLASSES: Record<"primary" | "secondary", string> = {
  primary: "bg-crm-primary text-white enabled:hover:bg-crm-primary-hover",
  secondary:
    "bg-white text-crm-text border border-[var(--color-border)] enabled:hover:bg-[#f3f4f6]",
};

export function Button({
  isLoading = false,
  variant = "primary",
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = [BASE, VARIANT_CLASSES[variant], className].filter(Boolean).join(" ");

  return (
    <button disabled={disabled || isLoading} className={classes} {...rest}>
      {children}
    </button>
  );
}
