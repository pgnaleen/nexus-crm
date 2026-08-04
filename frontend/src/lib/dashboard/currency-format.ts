// Shared k/M-abbreviated currency formatter for dashboard widgets --
// replaces each widget's own hardcoded "$" formatCurrency now that the
// dashboard's display currency is user-selectable, not fixed to USD.
export function formatDashboardAmount(value: number, currencyCode: string): string {
  const prefix = currencySymbol(currencyCode);
  if (Math.abs(value) >= 1000000) return `${prefix}${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${prefix}${(value / 1000).toFixed(0)}k`;
  return `${prefix}${value.toFixed(0)}`;
}

function currencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const symbolPart = parts.find((part) => part.type === "currency");
    return symbolPart?.value ?? `${currencyCode} `;
  } catch {
    return `${currencyCode} `;
  }
}
