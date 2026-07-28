// The full ISO 4217 currency list, straight from the JS runtime -- no
// dataset/library to keep in sync, same approach as TIMEZONES in
// ./timezones.ts. Available in every modern browser and Node 18+ (this
// repo runs Node 20).
export const CURRENCIES: string[] = Intl.supportedValuesOf("currency").sort();

// "USD" -> "USD — US Dollar" -- the code alone doesn't tell a non-technical
// user which currency it is, same reasoning as formatTimezoneLabel in
// ./timezones.ts.
export function formatCurrencyLabel(code: string): string {
  const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
  return name ? `${code} — ${name}` : code;
}
