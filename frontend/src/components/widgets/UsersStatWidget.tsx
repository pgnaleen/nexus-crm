import { StatCard } from "@/components/ui/StatCard";
import { UserIcon } from "@/components/ui/icons";

/** DUMMY preview value — swap for a real users-count endpoint later. */
export function UsersStatWidget() {
  return <StatCard label="Total Users" value={84} icon={<UserIcon size={16} />} />;
}
