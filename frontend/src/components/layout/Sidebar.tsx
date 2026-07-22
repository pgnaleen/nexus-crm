"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OreliaLogo } from "@/components/brand/OreliaLogo";
import { ChevronDownIcon, DashboardIcon, FunnelIcon, SettingsIcon, SlidersIcon, UsersGroupIcon, UserIcon, ActivityIcon } from "@/components/ui/icons";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { RelationshipTypeResponse, MainStageResponse } from "@orelia/common";

interface SidebarProps {
  tenantSlug: string;
  permissions: string[];
  relationshipTypes: RelationshipTypeResponse[];
  mainStages: MainStageResponse[];
}

// Items are gated by resource *prefix* (e.g. "department"), not a specific permission key --
// a user sees the section if they hold ANY permission under that prefix (view/create/update/
// delete, or manage while it still exists on some resources). This mirrors the same grouping
// logic RolePermissionsDialog already uses, and means this file never needs editing again just
// because a resource's specific permission set changes (e.g. Manage being removed).
function hasAnyPermissionForPrefix(permissions: string[], prefix: string): boolean {
  return permissions.some((p) => p.startsWith(`${prefix}:`));
}

const CRM_CONFIG_ITEMS: { label: string; segment: string; prefix?: string; isRoot?: boolean }[] = [
  { label: "Teams", segment: "teams", prefix: "teams" },
  { label: "Relationship Types", segment: "relationship-types", prefix: "relationship_type" },
  { label: "Deal Sources", segment: "deal-sources", prefix: "deal_source" },
  { label: "Main Stages", segment: "main-stages", prefix: "main_stage" },
  { label: "Sub Stages", segment: "sub-stages", prefix: "sub_stage" },
];

const ADMIN_ITEMS: { label: string; segment: string; prefix?: string; isRoot?: boolean }[] = [
  { label: "Tenants", segment: "tenants", prefix: "tenants" },
  { label: "Roles", segment: "roles", prefix: "rbac" },
  { label: "Users", segment: "users", isRoot: true, prefix: "users" },
  { label: "Departments", segment: "departments", prefix: "department" },
  { label: "Backups", segment: "backups", prefix: "backup" },
];

export function Sidebar({ tenantSlug, permissions, relationshipTypes, mainStages }: SidebarProps) {
  const pathname = usePathname();
  const adminBasePath = `/${tenantSlug}/admin/`;

  // Section Open States
  const [isDealsOpen, setIsDealsOpen] = useState(pathname.startsWith(`/${tenantSlug}/deals`));
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(pathname.startsWith(`/${tenantSlug}/relationships`));
  const [isHROpen, setIsHROpen] = useState(pathname.startsWith(`/${tenantSlug}/employees`));
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(pathname.startsWith(adminBasePath));
  
  // Navigation State
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const dashboardHref = `/${tenantSlug}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const funnelHref = `/${tenantSlug}/funnel`;
  const isFunnelActive = pathname === funnelHref;

  const hrHref = `/${tenantSlug}/employees`;
  const isHrActive = pathname === hrHref;

  const canSeeDeals = hasAnyPermissionForPrefix(permissions, "deals");
  const visibleAdminItems = ADMIN_ITEMS.filter(
    (item) => !item.prefix || hasAnyPermissionForPrefix(permissions, item.prefix),
  );
  const visibleConfigItems = CRM_CONFIG_ITEMS.filter(
    (item) => !item.prefix || hasAnyPermissionForPrefix(permissions, item.prefix),
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

        {/* FUNNEL ROOT LINK */}
        {canSeeDeals && (
          <Link
            href={funnelHref}
            className={isFunnelActive ? "sidebar-link active" : "sidebar-link"}
            onClick={() => handleLinkClick(isFunnelActive)}
          >
            <FunnelIcon size={17} />
            Funnel
          </Link>
        )}

        {/* DEALS GROUP */}
        {canSeeDeals && (
          <>
            <button
              type="button"
              className="sidebar-group-toggle"
              onClick={() => setIsDealsOpen((current) => !current)}
              aria-expanded={isDealsOpen}
            >
              <ActivityIcon size={17} />
              <span>Deals</span>
              <span className={isDealsOpen ? "sidebar-chevron open" : "sidebar-chevron"}>
                <ChevronDownIcon size={14} />
              </span>
            </button>

            {isDealsOpen && (
              <div className="sidebar-submenu">
                {mainStages.map((stage) => {
                  const href = `/${tenantSlug}/deals/${stage.id}`;
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
          </>
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
              const href = `/${tenantSlug}/relationships/${type.id}`;
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

        {/* HUMAN RESOURCES GROUP */}
        <button
          type="button"
          className="sidebar-group-toggle"
          onClick={() => setIsHROpen((current) => !current)}
          aria-expanded={isHROpen}
        >
          <UserIcon size={17} />
          <span>Human Resources</span>
          <span className={isHROpen ? "sidebar-chevron open" : "sidebar-chevron"}>
            <ChevronDownIcon size={14} />
          </span>
        </button>

        {isHROpen && (
          <div className="sidebar-submenu">
            <Link 
              href={hrHref} 
              className={isHrActive ? "sidebar-link active" : "sidebar-link"}
              onClick={() => handleLinkClick(isHrActive)}
            >
              Employees
            </Link>
          </div>
        )}
        {/* CRM CONFIGURATION GROUP */}
        {visibleConfigItems.length > 0 && (
          <button
            type="button"
            className="sidebar-group-toggle"
            onClick={() => setIsConfigOpen((current) => !current)}
            aria-expanded={isConfigOpen}
          >
            <SlidersIcon size={17} />
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
