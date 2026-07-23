"use client";

import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRIES } from "@/lib/countries";
import { SearchSelect, type SearchSelectOption } from "./SearchSelect";

// SVG flags (country-flag-icons), not emoji flags: Windows ships no country
// flag emojis at all (Segoe UI Emoji excludes them), so Chrome/Edge on
// Windows render emoji flags as bare letter pairs like "LK". SVGs are
// identical on every OS/browser.
const COUNTRY_OPTIONS: SearchSelectOption[] = COUNTRIES.map((country) => {
  const Flag = Flags[country.code as keyof typeof Flags];
  return {
    value: country.name,
    label: country.name,
    sublabel: country.code,
    icon: Flag ? (
      <Flag aria-hidden="true" className="w-5 shrink-0 rounded-[2px]" />
    ) : undefined,
  };
});

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
