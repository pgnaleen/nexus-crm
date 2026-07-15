import { StatCard } from "@/components/ui/StatCard";
import { UsersGroupIcon } from "@/components/ui/icons";

/** DUMMY preview value — Teams has no backend module yet (deferred). */
export function TeamsStatWidget() {
  return <StatCard label="Total Teams" value={3} icon={<UsersGroupIcon size={16} />} />;
}
