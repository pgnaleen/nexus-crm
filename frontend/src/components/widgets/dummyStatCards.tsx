import type { ReactNode } from "react";
import { StatCard } from "@/components/ui/StatCard";
import {
  ActivityIcon,
  BanIcon,
  BellIcon,
  BuildingIcon,
  CheckCircleIcon,
  DashboardIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileIcon,
  FunnelIcon,
  KeyIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersIcon,
  UploadCloudIcon,
  UserIcon,
  UsersGroupIcon,
} from "@/components/ui/icons";

// A larger dummy catalog of stat cards, purely to have enough widget variety to work with while
// the real "pick widgets from a panel" UI (a later, separate piece of work) doesn't exist yet.
// Data-driven rather than one file per card -- 20 near-identical StatCard wrappers would just be
// repetition, not a real abstraction need.
interface DummyStatCardDef {
  key: string;
  label: string;
  value: number;
  icon: ReactNode;
}

const DUMMY_STAT_CARDS: DummyStatCardDef[] = [
  { key: "dummyTenants", label: "Total Tenants", value: 12, icon: <BuildingIcon size={16} /> },
  { key: "dummyUsers", label: "Total Users", value: 84, icon: <UserIcon size={16} /> },
  { key: "dummyRoles", label: "Active Roles", value: 9, icon: <ShieldIcon size={16} /> },
  { key: "dummyTeams", label: "Total Teams", value: 6, icon: <UsersGroupIcon size={16} /> },
  { key: "dummyOpenDeals", label: "Open Deals", value: 47, icon: <ActivityIcon size={16} /> },
  { key: "dummyWonDeals", label: "Won Deals (MTD)", value: 15, icon: <CheckCircleIcon size={16} /> },
  { key: "dummyLostDeals", label: "Lost Deals (MTD)", value: 4, icon: <BanIcon size={16} /> },
  { key: "dummyNewLeads", label: "New Leads Today", value: 8, icon: <PlusIcon size={16} /> },
  { key: "dummyPendingApprovals", label: "Pending Approvals", value: 3, icon: <KeyIcon size={16} /> },
  { key: "dummyNotifications", label: "Notifications", value: 21, icon: <BellIcon size={16} /> },
  { key: "dummyCompanies", label: "Companies", value: 156, icon: <BuildingIcon size={16} /> },
  { key: "dummyContacts", label: "Contacts", value: 342, icon: <UserIcon size={16} /> },
  { key: "dummyDepartments", label: "Departments", value: 11, icon: <SlidersIcon size={16} /> },
  { key: "dummyDocuments", label: "Documents Uploaded", value: 78, icon: <UploadCloudIcon size={16} /> },
  { key: "dummyFiles", label: "Files Stored", value: 512, icon: <FileIcon size={16} /> },
  { key: "dummyFunnelStages", label: "Funnel Stages", value: 5, icon: <FunnelIcon size={16} /> },
  { key: "dummyPageViews", label: "Page Views Today", value: 1204, icon: <EyeIcon size={16} /> },
  { key: "dummyIntegrations", label: "External Integrations", value: 4, icon: <ExternalLinkIcon size={16} /> },
  { key: "dummySettingsChanged", label: "Settings Changed", value: 2, icon: <SettingsIcon size={16} /> },
  { key: "dummyWidgets", label: "Dashboard Widgets", value: 28, icon: <DashboardIcon size={16} /> },
];

export interface WidgetEntry {
  label: string;
  node: ReactNode;
}

export function getDummyStatWidgetEntries(): Record<string, WidgetEntry> {
  return Object.fromEntries(
    DUMMY_STAT_CARDS.map(({ key, label, value, icon }) => [
      key,
      { label, node: <StatCard key={key} label={label} value={value} icon={icon} /> },
    ]),
  );
}

export const DUMMY_STAT_CARD_KEYS = DUMMY_STAT_CARDS.map((card) => card.key);
