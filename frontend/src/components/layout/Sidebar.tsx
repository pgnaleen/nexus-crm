"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PERMISSIONS } from "@orelia/common";
import { OreliaLogo } from "@/components/brand/OreliaLogo";
import { ChevronDownIcon, DashboardIcon, FunnelIcon, SettingsIcon, UsersGroupIcon, UserIcon } from "@/components/ui/icons";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { MockFunnelStage, MockRelationshipType } from "@/lib/api/mock";

interface SidebarProps {
  tenantSlug: string;
  permissions: string[];
  relationshipTypes: MockRelationshipType[];
  funnelStages: MockFunnelStage[];
}

const CRM_CONFIG_ITEMS: { label: string; segment: string; permission?: string; isRoot?: boolean }[] = [
  { label: "Teams", segment: "teams" },
  { label: "Relationship Types", segment: "relationship-types" },
  { label: "Deal Sources", segment: "deal-sources" },
  { label: "Main Stages", segment: "main-stages" },
  { label: "Sub Stages", segment: "sub-stages" },
];

const ADMIN_ITEMS: { label: string; segment: string; permission?: string; isRoot?: boolean }[] = [
  { label: "Tenants", segment: "tenants", permission: PERMISSIONS.TENANTS_MANAGE },
  { label: "Roles", segment: "roles", permission: PERMISSIONS.RBAC_MANAGE },
  { label: "Users", segment: "users", isRoot: true },
  { label: "Departments", segment: "departments" },
];

export function Sidebar({ tenantSlug, permissions, relationshipTypes, funnelStages }: SidebarProps) {
  const pathname = usePathname();
  const adminBasePath = `/${tenantSlug}/admin/`;

  // Section Open States
  const [isFunnelOpen, setIsFunnelOpen] = useState(pathname.startsWith(`/${tenantSlug}/funnel`));
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(pathname.startsWith(`/${tenantSlug}/relationships`));
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith(adminBasePath));
  
  // Navigation State
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const dashboardHref = `/${tenantSlug}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const hrHref = `/${tenantSlug}/employees`;
  const isHrActive = pathname === hrHref;

  const visibleAdminItems = ADMIN_ITEMS.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );
  const visibleConfigItems = CRM_CONFIG_ITEMS.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

  function handleLinkClick(isActive: boolean) {
    if (!isActive) setIsNavigating(true);
  }

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <OreliaLogo dark size={26} showTagline={false} />
        </div>

        <Link 
          href={dashboardHref} 
          className={isDashboardActive ? "sidebar-link active" : "sidebar-link"}
          onClick={() => handleLinkClick(isDashboardActive)}
        >
          <DashboardIcon size={17} />
          Dashboard
        </Link>

        {/* FUNNEL GROUP */}
        <button
          type="button"
          className="sidebar-group-toggle"
          onClick={() => setIsFunnelOpen((current) => !current)}
          aria-expanded={isFunnelOpen}
        >
          <FunnelIcon size={17} />
          <span>Funnel</span>
          <span className={isFunnelOpen ? "sidebar-chevron open" : "sidebar-chevron"}>
            <ChevronDownIcon size={14} />
          </span>
        </button>

        {isFunnelOpen && (
          <div className="sidebar-submenu">
            {funnelStages.map((stage) => {
              const href = `/${tenantSlug}/funnel/${stage.slug}`;
              const isActive = pathname === href;
              return (
                <Link 
                  key={href} 
                  href={href} 
                  className={isActive ? "sidebar-link active" : "sidebar-link"}
                  onClick={() => handleLinkClick(isActive)}
                >
                  {stage.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* RELATIONSHIPS GROUP */}
        <button
          type="button"
          className="sidebar-group-toggle"
          onClick={() => setIsRelationshipsOpen((current) => !current)}
          aria-expanded={isRelationshipsOpen}
        >
          <UsersGroupIcon size={17} />
          <span>Relationships</span>
          <span className={isRelationshipsOpen ? "sidebar-chevron open" : "sidebar-chevron"}>
            <ChevronDownIcon size={14} />
          </span>
        </button>

        {isRelationshipsOpen && (
          <div className="sidebar-submenu">
            {relationshipTypes.map((type) => {
              const href = `/${tenantSlug}/relationships/${type.slug}`;
              const isActive = pathname === href;
              return (
                <Link 
                  key={href} 
                  href={href} 
                  className={isActive ? "sidebar-link active" : "sidebar-link"}
                  onClick={() => handleLinkClick(isActive)}
                >
                  {type.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* HUMAN RESOURCES */}
        <Link 
          href={hrHref} 
          className={isHrActive ? "sidebar-link active" : "sidebar-link"}
          onClick={() => handleLinkClick(isHrActive)}
        >
          <UserIcon size={17} />
          Human Resources
        </Link>

        {/* CRM CONFIGURATION GROUP */}
        {visibleConfigItems.length > 0 && (
          <button
            type="button"
            className="sidebar-group-toggle"
            onClick={() => setIsConfigOpen((current) => !current)}
            aria-expanded={isConfigOpen}
          >
            <SettingsIcon size={17} />
            <span>CRM Configuration</span>
            <span className={isConfigOpen ? "sidebar-chevron open" : "sidebar-chevron"}>
              <ChevronDownIcon size={14} />
            </span>
          </button>
        )}

        {isConfigOpen && visibleConfigItems.length > 0 && (
          <div className="sidebar-submenu">
            {visibleConfigItems.map(({ label, segment, isRoot }) => {
              const href = isRoot ? `/${tenantSlug}/${segment}` : `${adminBasePath}${segment}`;
              const isActive = pathname === href;
              return (
                <Link 
                  key={href} 
                  href={href} 
                  className={isActive ? "sidebar-link active" : "sidebar-link"}
                  onClick={() => handleLinkClick(isActive)}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {/* SYSTEM ADMINISTRATION GROUP */}
        {visibleAdminItems.length > 0 && (
          <button
            type="button"
            className="sidebar-group-toggle"
            onClick={() => setIsAdminOpen((current) => !current)}
            aria-expanded={isAdminOpen}
          >
            <SettingsIcon size={17} />
            <span>System Administration</span>
            <span className={isAdminOpen ? "sidebar-chevron open" : "sidebar-chevron"}>
              <ChevronDownIcon size={14} />
            </span>
          </button>
        )}

        {isAdminOpen && visibleAdminItems.length > 0 && (
          <div className="sidebar-submenu">
            {visibleAdminItems.map(({ label, segment, isRoot }) => {
              const href = isRoot ? `/${tenantSlug}/${segment}` : `${adminBasePath}${segment}`;
              const isActive = pathname === href;
              return (
                <Link 
                  key={href} 
                  href={href} 
                  className={isActive ? "sidebar-link active" : "sidebar-link"}
                  onClick={() => handleLinkClick(isActive)}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
      {isNavigating && <LoadingOverlay />}
    </>
  );
}
