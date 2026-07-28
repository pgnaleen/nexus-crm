"use client";

import { CURRENCIES, formatCurrencyLabel } from "@/lib/currencies";
import { SearchSelect, type SearchSelectOption } from "./SearchSelect";

const CURRENCY_OPTIONS: SearchSelectOption[] = CURRENCIES.map((code) => ({
  value: code,
  label: formatCurrencyLabel(code),
}));

interface CurrencySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Reusable "currency" picker -- searchable dropdown backed by the runtime's
// own ISO 4217 currency list (see lib/currencies.ts), same pattern as
// TimezoneSelect.
export function CurrencySelect({
  label,
  value,
  onChange,
  placeholder = "Select a currency...",
  disabled,
}: CurrencySelectProps) {
  return (
    <div className="mb-[18px]">
      {label && (
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</label>
      )}
      <SearchSelect
        value={value}
        onChange={onChange}
        options={CURRENCY_OPTIONS}
        placeholder={placeholder}
        searchPlaceholder="Search currencies..."
        disabled={disabled}
      />
    </div>
  );
}
