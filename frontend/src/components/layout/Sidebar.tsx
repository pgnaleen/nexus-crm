"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OreliaLogo } from "@/components/brand/OreliaLogo";
import { ChevronDownIcon, DashboardIcon, FunnelIcon, PriorityIcon, SettingsIcon, SlidersIcon, UsersGroupIcon, UserIcon, ActivityIcon } from "@/components/ui/icons";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { PERMISSIONS } from "@orelia/common";
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

const LINK_BASE =
  "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-white/65 no-underline transition-colors duration-150 hover:bg-white/10 hover:text-white";
const LINK_ACTIVE = "bg-crm-primary font-semibold text-white hover:bg-crm-primary hover:text-white";
const SUBMENU_LINK_BASE =
  "flex items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[13.5px] font-medium text-white/65 no-underline transition-colors duration-150 hover:bg-white/10 hover:text-white";
const GROUP_TOGGLE =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-none bg-transparent px-3 py-2.5 text-left text-sm font-medium text-white/65 transition-colors duration-150 hover:bg-white/10 hover:text-white";

function linkClasses(isActive: boolean, isSubmenu = false): string {
  const base = isSubmenu ? SUBMENU_LINK_BASE : LINK_BASE;
  return isActive ? `${base} ${LINK_ACTIVE}` : base;
}

function chevronClasses(isOpen: boolean): string {
  return isOpen ? "flex rotate-180 transition-transform duration-150" : "flex transition-transform duration-150";
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

  const priorityHref = `/${tenantSlug}/priority`;
  const isPriorityActive = pathname === priorityHref;

  const funnelHref = `/${tenantSlug}/funnel`;
  const isFunnelActive = pathname === funnelHref;

  const hrHref = `/${tenantSlug}/employees`;
  const isHrActive = pathname === hrHref;

  const orgChartHref = `/${tenantSlug}/employees/org-chart`;
  const isOrgChartActive = pathname === orgChartHref;

  const certReviewHref = `/${tenantSlug}/employees/certifications`;
  const isCertReviewActive = pathname === certReviewHref;

  const canSeeDeals = hasAnyPermissionForPrefix(permissions, "deals");
  const canSeeEmployees = hasAnyPermissionForPrefix(permissions, "employees");
  const canReviewCertifications = permissions.includes(PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS);
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
      <nav className="flex w-[250px] flex-shrink-0 flex-col gap-0.5 overflow-y-auto px-3.5 py-5">
        <div className="px-2.5 pt-2 pb-[26px]">
          <OreliaLogo dark size={26} showTagline={false} />
        </div>

        <Link
          href={dashboardHref}
          className={linkClasses(isDashboardActive)}
          onClick={() => handleLinkClick(isDashboardActive)}
        >
          <DashboardIcon size={17} />
          Dashboard
        </Link>

        {/* PRIORITY TRACKER ROOT LINK -- gated by authentication only, same
            as Dashboard, no resource permission (every user manages their
            own personal board). */}
        <Link
          href={priorityHref}
          className={linkClasses(isPriorityActive)}
          onClick={() => handleLinkClick(isPriorityActive)}
        >
          <PriorityIcon size={17} />
          Priority Tracker
        </Link>

        {/* FUNNEL ROOT LINK */}
        {canSeeDeals && (
          <Link
            href={funnelHref}
            className={linkClasses(isFunnelActive)}
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
              className={GROUP_TOGGLE}
              onClick={() => setIsDealsOpen((current) => !current)}
              aria-expanded={isDealsOpen}
            >
              <ActivityIcon size={17} />
              <span className="flex-1">Deals</span>
              <span className={chevronClasses(isDealsOpen)}>
                <ChevronDownIcon size={14} />
              </span>
            </button>

            {isDealsOpen && (
              <div className="mt-0.5 mb-1.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                {mainStages.map((stage) => {
                  const href = `/${tenantSlug}/deals/${stage.id}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={linkClasses(isActive, true)}
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
          className={GROUP_TOGGLE}
          onClick={() => setIsRelationshipsOpen((current) => !current)}
          aria-expanded={isRelationshipsOpen}
        >
          <UsersGroupIcon size={17} />
          <span className="flex-1">Relationships</span>
          <span className={chevronClasses(isRelationshipsOpen)}>
            <ChevronDownIcon size={14} />
          </span>
        </button>

        {isRelationshipsOpen && (
          <div className="mt-0.5 mb-1.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
            {relationshipTypes.map((type) => {
              const href = `/${tenantSlug}/relationships/${type.id}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={linkClasses(isActive, true)}
                  onClick={() => handleLinkClick(isActive)}
                >
                  {type.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* HUMAN RESOURCES GROUP */}
        {canSeeEmployees && (
          <>
            <button
              type="button"
              className={GROUP_TOGGLE}
              onClick={() => setIsHROpen((current) => !current)}
              aria-expanded={isHROpen}
            >
              <UserIcon size={17} />
              <span className="flex-1">Human Resources</span>
              <span className={chevronClasses(isHROpen)}>
                <ChevronDownIcon size={14} />
              </span>
            </button>

            {isHROpen && (
              <div className="mt-0.5 mb-1.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                <Link
                  href={hrHref}
                  className={linkClasses(isHrActive, true)}
                  onClick={() => handleLinkClick(isHrActive)}
                >
                  Employees
                </Link>
                <Link
                  href={orgChartHref}
                  className={linkClasses(isOrgChartActive, true)}
                  onClick={() => handleLinkClick(isOrgChartActive)}
                >
                  Organization Chart
                </Link>
                {canReviewCertifications && (
                  <Link
                    href={certReviewHref}
                    className={linkClasses(isCertReviewActive, true)}
                    onClick={() => handleLinkClick(isCertReviewActive)}
                  >
                    Certification Review
                  </Link>
                )}
              </div>
            )}
          </>
        )}
        {/* CRM CONFIGURATION GROUP */}
        {visibleConfigItems.length > 0 && (
          <button
            type="button"
            className={GROUP_TOGGLE}
            onClick={() => setIsConfigOpen((current) => !current)}
            aria-expanded={isConfigOpen}
          >
            <SlidersIcon size={17} />
            <span className="flex-1">CRM Configuration</span>
            <span className={chevronClasses(isConfigOpen)}>
              <ChevronDownIcon size={14} />
            </span>
          </button>
        )}

        {isConfigOpen && visibleConfigItems.length > 0 && (
          <div className="mt-0.5 mb-1.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
            {visibleConfigItems.map(({ label, segment, isRoot }) => {
              const href = isRoot ? `/${tenantSlug}/${segment}` : `${adminBasePath}${segment}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={linkClasses(isActive, true)}
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
            className={GROUP_TOGGLE}
            onClick={() => setIsAdminOpen((current) => !current)}
            aria-expanded={isAdminOpen}
          >
            <SettingsIcon size={17} />
            <span className="flex-1">System Administration</span>
            <span className={chevronClasses(isAdminOpen)}>
              <ChevronDownIcon size={14} />
            </span>
          </button>
        )}

        {isAdminOpen && visibleAdminItems.length > 0 && (
          <div className="mt-0.5 mb-1.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
            {visibleAdminItems.map(({ label, segment, isRoot }) => {
              const href = isRoot ? `/${tenantSlug}/${segment}` : `${adminBasePath}${segment}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={linkClasses(isActive, true)}
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
