"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import { OreliaLogo } from "@/components/brand/OreliaLogo";
import { ChevronDownIcon, DashboardIcon, FunnelIcon, SettingsIcon } from "@/components/ui/icons";

interface SidebarProps {
  tenantSlug: string;
  permissions: string[];
}

// `permission: undefined` means the item has no permission gate yet (its
// section hasn't been built out with real RBAC enforcement) — always shown.
const ADMIN_ITEMS: { label: string; segment: string; permission?: string }[] = [
  { label: "Tenant Management", segment: "tenants", permission: PERMISSIONS.TENANTS_MANAGE },
  { label: "Roles Management", segment: "roles", permission: PERMISSIONS.RBAC_MANAGE },
  { label: "User Management", segment: "users" },
  { label: "Teams Management", segment: "teams" },
  { label: "Relationship Types Management", segment: "relationship-types" },
  { label: "Department Management", segment: "departments" },
];

export function Sidebar({ tenantSlug, permissions }: SidebarProps) {
  const pathname = usePathname();
  const adminBasePath = `/${tenantSlug}/admin/`;
  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith(adminBasePath));

  const dashboardHref = `/${tenantSlug}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const funnelHref = `/${tenantSlug}/funnel`;
  const isFunnelActive = pathname === funnelHref;

  const visibleAdminItems = ADMIN_ITEMS.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <OreliaLogo dark size={26} showTagline={false} />
      </div>

      <Link href={dashboardHref} className={isDashboardActive ? "sidebar-link active" : "sidebar-link"}>
        <DashboardIcon size={17} />
        Dashboard
      </Link>

      <Link href={funnelHref} className={isFunnelActive ? "sidebar-link active" : "sidebar-link"}>
        <FunnelIcon size={17} />
        Funnel
      </Link>

      {visibleAdminItems.length > 0 && (
        <button
          type="button"
          className="sidebar-group-toggle"
          onClick={() => setIsAdminOpen((current) => !current)}
          aria-expanded={isAdminOpen}
        >
          <SettingsIcon size={17} />
          <span>Administration</span>
          <span className={isAdminOpen ? "sidebar-chevron open" : "sidebar-chevron"}>
            <ChevronDownIcon size={14} />
          </span>
        </button>
      )}

      {isAdminOpen && visibleAdminItems.length > 0 && (
        <div className="sidebar-submenu">
          {visibleAdminItems.map(({ label, segment }) => {
            const href = `${adminBasePath}${segment}`;
            const isActive = pathname === href;
            return (
              <Link key={href} href={href} className={isActive ? "sidebar-link active" : "sidebar-link"}>
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
