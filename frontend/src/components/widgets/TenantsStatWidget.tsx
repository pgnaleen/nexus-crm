import { StatCard } from "@/components/ui/StatCard";
import { BuildingIcon } from "@/components/ui/icons";

/** DUMMY preview value — swap for a real tenants-count endpoint later. */
export function TenantsStatWidget() {
  return <StatCard label="Total Tenants" value={12} icon={<BuildingIcon size={16} />} />;
}
