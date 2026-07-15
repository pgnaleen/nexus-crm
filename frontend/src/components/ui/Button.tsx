import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary";
}

export function Button({
  isLoading = false,
  variant = "primary",
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");

  return (
    <button disabled={disabled || isLoading} className={classes} {...rest}>
      {children}
    </button>
  );
}
