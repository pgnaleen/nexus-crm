interface PasswordStrengthHintProps {
  password: string;
}

const RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "A number", test: (v) => /\d/.test(v) },
  { label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

// Live checklist shown while setting/resetting a password. Kept out of
// PasswordField itself since that component is also used on the login form,
// where these requirements don't apply.
export function PasswordStrengthHint({ password }: PasswordStrengthHintProps) {
  return (
    <ul className="password-strength-hint">
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.label} style={{ color: met ? "#059669" : "var(--color-text-muted)" }}>
            <span aria-hidden="true">{met ? "✓" : "○"}</span> {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
