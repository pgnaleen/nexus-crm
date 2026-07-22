// Shared pure display helpers used by both AddDealDialog and ViewDealDialog,
// so the Costing formula and Notes formatting can't drift between the two.

export interface CostingSummary {
  totalCost: number;
  profit: number;
  markupPercent: number;
  marginPercent: number;
}

// Total Cost, Profit, Markup, and Margin are always derived from the three
// raw inputs -- never stored -- so they can't drift out of sync with them.
//   Total Cost = Internal Costs + External Costs
//   Profit     = Project Value − Total Cost
//   Markup     = Profit / Total Cost
//   Margin     = Profit / Project Value
export function computeCosting(
  projectValue: number | string,
  internalCosts: number | string,
  externalCosts: number | string,
): CostingSummary {
  const value = Number(projectValue) || 0;
  const internal = Number(internalCosts) || 0;
  const external = Number(externalCosts) || 0;
  const totalCost = internal + external;
  const profit = value - totalCost;
  const markupPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const marginPercent = value > 0 ? (profit / value) * 100 : 0;
  return { totalCost, profit, markupPercent, marginPercent };
}

export function formatLkr(amount: number): string {
  return amount.toLocaleString("en-LK", { maximumFractionDigits: 2 });
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function formatNoteTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
