// The full IANA timezone database, straight from the JS runtime -- no
// dataset/library to keep in sync, unlike COUNTRIES in ./countries.ts.
// Available in every modern browser and Node 18+ (this repo runs Node 20).
export const TIMEZONES: string[] = Intl.supportedValuesOf("timeZone").sort();

// "Asia/Colombo" -> "Asia/Colombo (GMT+05:30)" -- the offset alone
// ("GMT+05:30") is ambiguous across a dozen zones; the IANA name alone
// doesn't tell a non-technical user where in the world it is. Showing both
// mirrors CountrySelect showing both the country name and its ISO code.
export function formatTimezoneLabel(timezone: string, now = new Date()): string {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value;
  return offset ? `${timezone} (${offset})` : timezone;
}
