import { StatCard } from "@/components/ui/StatCard";
import { ShieldIcon } from "@/components/ui/icons";

/** DUMMY preview value — swap for a real roles-count endpoint later. */
export function RolesStatWidget() {
  return <StatCard label="Total Roles" value={6} icon={<ShieldIcon size={16} />} />;
}
