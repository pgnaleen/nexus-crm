"use client";

import { COUNTRIES } from "@/lib/countries";
import { SearchSelect, type SearchSelectOption } from "./SearchSelect";

const COUNTRY_OPTIONS: SearchSelectOption[] = COUNTRIES.map((country) => ({
  value: country.name,
  label: country.name,
  sublabel: country.code,
  icon: (
    <span aria-hidden="true" className="text-base leading-none">
      {country.flag}
    </span>
  ),
}));

interface CountrySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Reusable company/contact/deal "country" picker -- searchable, flagged
// dropdown backed by the `countries-list` ISO data. Stores/reads the plain
// country name (matching the free-text `country`/`dealCountry` columns
// these fields already write to), not the ISO code.
export function CountrySelect({
  label,
  value,
  onChange,
  placeholder = "Select a country...",
  disabled,
}: CountrySelectProps) {
  return (
    <div className="mb-[18px]">
      {label && (
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</label>
      )}
      <SearchSelect
        value={value}
        onChange={onChange}
        options={COUNTRY_OPTIONS}
        placeholder={placeholder}
        searchPlaceholder="Search countries..."
        disabled={disabled}
      />
    </div>
  );
}
