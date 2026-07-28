"use client";

import { TIMEZONES, formatTimezoneLabel } from "@/lib/timezones";
import { SearchSelect, type SearchSelectOption } from "./SearchSelect";

const TIMEZONE_OPTIONS: SearchSelectOption[] = TIMEZONES.map((timezone) => ({
  value: timezone,
  label: formatTimezoneLabel(timezone),
}));

interface TimezoneSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Reusable "timezone" picker -- searchable dropdown backed by the runtime's
// own IANA timezone database (see lib/timezones.ts), same pattern as
// CountrySelect. Restricts entry to real zone names instead of the free-text
// field this replaces, which accepted anything.
export function TimezoneSelect({
  label,
  value,
  onChange,
  placeholder = "Select a timezone...",
  disabled,
}: TimezoneSelectProps) {
  return (
    <div className="mb-[18px]">
      {label && (
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</label>
      )}
      <SearchSelect
        value={value}
        onChange={onChange}
        options={TIMEZONE_OPTIONS}
        placeholder={placeholder}
        searchPlaceholder="Search timezones..."
        disabled={disabled}
      />
    </div>
  );
}
