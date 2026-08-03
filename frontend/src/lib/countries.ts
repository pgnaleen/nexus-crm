import { getCountryDataList, getEmojiFlag, type TCountryCode } from "countries-list";

export interface Country {
  code: TCountryCode;
  name: string;
  flag: string;
}

// Sourced from the `countries-list` package (ISO 3166-1 names + alpha-2
// codes) rather than hand-maintained here. Country fields across the app
// (Company, Contact, Employee, Deal) are all plain free-text string
// columns, not an enum, so consumers store/compare by `name`.
export const COUNTRIES: Country[] = getCountryDataList()
  .map((country) => ({ code: country.iso2, name: country.name, flag: getEmojiFlag(country.iso2) }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Maps plain country name → primary ISO 4217 currency code.
// Used by AddDealDialog to auto-fill the Currency field when a Deal Country is selected.
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {};
try {
  for (const country of getCountryDataList()) {
    const primaryCurrency = country.currency?.[0];
    if (primaryCurrency) {
      COUNTRY_CURRENCY_MAP[country.name] = primaryCurrency;
    }
  }
} catch (e) {
  console.error("Failed to build country→currency map:", e);
}
