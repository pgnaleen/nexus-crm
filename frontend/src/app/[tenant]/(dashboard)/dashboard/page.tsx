import { ActivityWidget } from "@/components/widgets/ActivityWidget";
import { RolesStatWidget } from "@/components/widgets/RolesStatWidget";
import { TeamsStatWidget } from "@/components/widgets/TeamsStatWidget";
import { TenantsStatWidget } from "@/components/widgets/TenantsStatWidget";
import { UsersStatWidget } from "@/components/widgets/UsersStatWidget";

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <div>
        <h2 className="section-heading">Dashboard</h2>
        <div className="stat-grid">
          <TenantsStatWidget />
          <UsersStatWidget />
          <RolesStatWidget />
          <TeamsStatWidget />
        </div>
      </div>

      <ActivityWidget />
    </div>
  );
}
