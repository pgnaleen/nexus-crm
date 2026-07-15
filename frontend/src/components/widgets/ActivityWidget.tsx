import { BuildingIcon, ShieldIcon, UserIcon, UsersGroupIcon } from "@/components/ui/icons";

// DUMMY preview data — swap for a real activity/audit-log feed later.
// Deliberately more items than fit in the panel's max-height, to demonstrate
// its internal scroll.
const DUMMY_ACTIVITIES = [
  { Icon: BuildingIcon, text: 'Tenant "Acme Corp" was created', time: "2h ago" },
  { Icon: ShieldIcon, text: 'Role "Sales Manager" was updated', time: "5h ago" },
  { Icon: UserIcon, text: 'User "jane.doe" was added', time: "Yesterday" },
  { Icon: UsersGroupIcon, text: 'Team "Enterprise Sales" was created', time: "2 days ago" },
  { Icon: BuildingIcon, text: 'Tenant "Globex Inc" was created', time: "3 days ago" },
  { Icon: ShieldIcon, text: 'Role "Support Agent" was created', time: "4 days ago" },
  { Icon: UserIcon, text: 'User "mike.chen" was added', time: "5 days ago" },
  { Icon: UsersGroupIcon, text: 'Team "Customer Success" was created', time: "1 week ago" },
];

export function ActivityWidget() {
  return (
    <div className="content-card">
      <h2 className="content-card-title">Widgets</h2>
      <div className="activity-list">
        {DUMMY_ACTIVITIES.map(({ Icon, text, time }) => (
          <div className="activity-item" key={text}>
            <div className="activity-icon">
              <Icon size={14} />
            </div>
            <div className="activity-text">{text}</div>
            <div className="activity-time">{time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
