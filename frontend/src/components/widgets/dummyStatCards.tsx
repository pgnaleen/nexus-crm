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

// A dummy catalog of stat cards to populate the dashboard based on the requested KPIs.
interface DummyStatCardDef {
  key: string;
  label: string;
  value: string | number;
  icon: ReactNode;
}

const DUMMY_STAT_CARDS: DummyStatCardDef[] = [
  { key: "totalDeals", label: "Total Deals", value: 342, icon: <FunnelIcon size={16} /> },
  { key: "pipelineValue", label: "Total Pipeline Value", value: "$4.2M", icon: <ActivityIcon size={16} /> },
  { key: "winLossRate", label: "Win/Loss Rate", value: "68% Won", icon: <CheckCircleIcon size={16} /> },
  { key: "avgGp", label: "Avg GP Margin", value: "24%", icon: <SlidersIcon size={16} /> },
  { key: "salesVelocity", label: "Sales Velocity", value: "28 Days", icon: <DashboardIcon size={16} /> },
  { key: "pipelineCoverage", label: "Pipeline Coverage", value: "3.2x", icon: <ShieldIcon size={16} /> },
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
