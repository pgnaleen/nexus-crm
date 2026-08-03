"use client";

import * as Flags from "country-flag-icons/react/3x2";
import { CURRENCIES, formatCurrencyLabel } from "@/lib/currencies";
import { SearchSelect, type SearchSelectOption } from "./SearchSelect";

const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  LKR: "LK",
  INR: "IN",
  AUD: "AU",
  CAD: "CA",
  SGD: "SG",
  JPY: "JP",
  CNY: "CN",
  CHF: "CH",
  AED: "AE",
  SAR: "SA",
  QAR: "QA",
  OMR: "OM",
  BHD: "BH",
  KWD: "KW",
  NZD: "NZ",
  HKD: "HK",
  ZAR: "ZA",
};

const CURRENCY_OPTIONS: SearchSelectOption[] = CURRENCIES.map((code) => {
  const countryCode = CURRENCY_TO_COUNTRY[code];
  const Flag = countryCode ? Flags[countryCode as keyof typeof Flags] : undefined;
  return {
    value: code,
    label: formatCurrencyLabel(code),
    icon: Flag ? (
      <Flag aria-hidden="true" className="w-5 shrink-0 rounded-[2px]" />
    ) : undefined,
  };
});

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
