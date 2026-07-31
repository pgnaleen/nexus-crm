"use client";

import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRIES } from "@/lib/countries";
import { MultiSelect, type MultiSelectOption } from "./MultiSelect";

// SVG flags rather than emoji, for the reason documented in CountrySelect:
// Windows ships no country flag emojis, so Chrome/Edge render them as bare
// letter pairs like "LK". Same option list, same shape, built once at module
// load -- COUNTRIES is a static ISO dataset.
const COUNTRY_OPTIONS: MultiSelectOption[] = COUNTRIES.map((country) => {
  const Flag = Flags[country.code as keyof typeof Flags];
  return {
    value: country.name,
    label: country.name,
    sublabel: country.code,
    icon: Flag ? <Flag aria-hidden="true" className="w-5 shrink-0 rounded-[2px]" /> : undefined,
  };
});

interface CountryMultiSelectProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

// The multi-value sibling of CountrySelect, for records that span several
// countries (today: Company). Stores plain country names, not ISO codes,
// matching what the jsonb `countries` column holds and what
// findDistinctCountries reads back out.
export function CountryMultiSelect({
  label,
  values,
  onChange,
  placeholder = "Select countries...",
  searchPlaceholder = "Search countries...",
  disabled,
}: CountryMultiSelectProps) {
  return (
    <div className="mb-[18px]">
      <MultiSelect
        label={label}
        values={values}
        onChange={onChange}
        options={COUNTRY_OPTIONS}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        disabled={disabled}
      />
    </div>
  );
}
