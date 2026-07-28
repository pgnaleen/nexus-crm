"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OreliaLogo } from "@/components/brand/OreliaLogo";
import { ChevronDownIcon, ChevronRightIcon, DashboardIcon, FunnelIcon, PriorityIcon, SettingsIcon, SlidersIcon, UsersGroupIcon, UserIcon, ActivityIcon } from "@/components/ui/icons";
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

// Below this width the sidebar auto-collapses to the icon-only rail (unless
// the user has already made an explicit collapse/expand choice -- see
// `manualOverride` below). Matches Tailwind's `lg` breakpoint.
const COLLAPSE_BREAKPOINT_PX = 1024;
const COLLAPSE_STORAGE_KEY = "orelia-sidebar-collapsed";

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

  // Collapse state -- manualOverride wins outright once set (persisted, so
  // it's remembered across visits regardless of screen width); before any
  // explicit choice exists, `collapsed` just follows the live window width.
  // Client-only state, same as isNavigating above -- there's a brief flash
  // to the correct state on first paint, an accepted trade-off rather than
  // adding cookie-based SSR just to avoid it.
  const [manualOverride, setManualOverrideState] = useState<boolean | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (saved !== null) setManualOverrideState(saved === "true");

    const checkWidth = () => setIsNarrow(window.innerWidth < COLLAPSE_BREAKPOINT_PX);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  function setManualOverride(value: boolean) {
    setManualOverrideState(value);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(value));
  }

  const collapsed = manualOverride !== null ? manualOverride : isNarrow;

  // Shared by every group toggle (Deals/Relationships/HR/Config/Admin): while
  // collapsed, a group's sub-items have no icons of their own, so clicking
  // its icon expands the sidebar (persisting that choice) and opens that
  // group, rather than toggling an open state nothing can render yet.
  function handleGroupToggle(isOpen: boolean, setIsOpen: (value: boolean) => void) {
    if (collapsed) {
      setManualOverride(false);
      setIsOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
  }

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

  const certifiedHref = `/${tenantSlug}/employees/certified`;
  const isCertifiedActive = pathname === certifiedHref;

  const canSeeDeals = hasAnyPermissionForPrefix(permissions, "deals");
  const canSeeEmployees = hasAnyPermissionForPrefix(permissions, "employees");
  const canReviewCertifications = permissions.includes(PERMISSIONS.EMPLOYEES_VERIFY_CERTIFICATIONS);
  const canViewEmployees = permissions.includes(PERMISSIONS.EMPLOYEES_VIEW);
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
      <nav
        className={`flex flex-shrink-0 flex-col gap-0.5 overflow-x-hidden overflow-y-auto py-5 transition-[width] duration-200 ${
          collapsed ? "w-[72px] px-2" : "w-[250px] px-3.5"
        }`}
      >
        <div className={`flex items-center pt-2 pb-[26px] ${collapsed ? "flex-col gap-2" : "justify-between px-0.5"}`}>
          <OreliaLogo dark size={26} showTagline={false} iconOnly={collapsed} />
          <button
            type="button"
            onClick={() => setManualOverride(!collapsed)}
            className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className={collapsed ? "flex" : "flex rotate-180 transition-transform duration-150"}>
              <ChevronRightIcon size={14} />
            </span>
          </button>
        </div>

        <Link
          href={dashboardHref}
          className={`${linkClasses(isDashboardActive)} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleLinkClick(isDashboardActive)}
          title={collapsed ? "Dashboard" : undefined}
        >
          <DashboardIcon size={17} />
          {!collapsed && "Dashboard"}
        </Link>

        {/* PRIORITY TRACKER ROOT LINK -- gated by authentication only, same
            as Dashboard, no resource permission (every user manages their
            own personal board). */}
        <Link
          href={priorityHref}
          className={`${linkClasses(isPriorityActive)} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleLinkClick(isPriorityActive)}
          title={collapsed ? "Priority Tracker" : undefined}
        >
          <PriorityIcon size={17} />
          {!collapsed && "Priority Tracker"}
        </Link>

        {/* FUNNEL ROOT LINK */}
        {canSeeDeals && (
          <Link
            href={funnelHref}
            className={`${linkClasses(isFunnelActive)} ${collapsed ? "justify-center" : ""}`}
            onClick={() => handleLinkClick(isFunnelActive)}
            title={collapsed ? "Funnel" : undefined}
          >
            <FunnelIcon size={17} />
            {!collapsed && "Funnel"}
          </Link>
        )}

        {/* DEALS GROUP */}
        {canSeeDeals && (
          <>
            <button
              type="button"
              className={`${GROUP_TOGGLE} ${collapsed ? "justify-center" : ""}`}
              onClick={() => handleGroupToggle(isDealsOpen, setIsDealsOpen)}
              aria-expanded={isDealsOpen}
              title={collapsed ? "Deals" : undefined}
            >
              <ActivityIcon size={17} />
              {!collapsed && <span className="flex-1">Deals</span>}
              {!collapsed && (
                <span className={chevronClasses(isDealsOpen)}>
                  <ChevronDownIcon size={14} />
                </span>
              )}
            </button>

            {!collapsed && isDealsOpen && (
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
          className={`${GROUP_TOGGLE} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleGroupToggle(isRelationshipsOpen, setIsRelationshipsOpen)}
          aria-expanded={isRelationshipsOpen}
          title={collapsed ? "Relationships" : undefined}
        >
          <UsersGroupIcon size={17} />
          {!collapsed && <span className="flex-1">Relationships</span>}
          {!collapsed && (
            <span className={chevronClasses(isRelationshipsOpen)}>
              <ChevronDownIcon size={14} />
            </span>
          )}
        </button>

        {!collapsed && isRelationshipsOpen && (
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
              className={`${GROUP_TOGGLE} ${collapsed ? "justify-center" : ""}`}
              onClick={() => handleGroupToggle(isHROpen, setIsHROpen)}
              aria-expanded={isHROpen}
              title={collapsed ? "Human Resources" : undefined}
            >
              <UserIcon size={17} />
              {!collapsed && <span className="flex-1">Human Resources</span>}
              {!collapsed && (
                <span className={chevronClasses(isHROpen)}>
                  <ChevronDownIcon size={14} />
                </span>
              )}
            </button>

            {!collapsed && isHROpen && (
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
                {canViewEmployees && (
                  <Link
                    href={certifiedHref}
                    className={linkClasses(isCertifiedActive, true)}
                    onClick={() => handleLinkClick(isCertifiedActive)}
                  >
                    Certified Employees
                  </Link>
                )}
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
            className={`${GROUP_TOGGLE} ${collapsed ? "justify-center" : ""}`}
            onClick={() => handleGroupToggle(isConfigOpen, setIsConfigOpen)}
            aria-expanded={isConfigOpen}
            title={collapsed ? "CRM Configuration" : undefined}
          >
            <SlidersIcon size={17} />
            {!collapsed && <span className="flex-1">CRM Configuration</span>}
            {!collapsed && (
              <span className={chevronClasses(isConfigOpen)}>
                <ChevronDownIcon size={14} />
              </span>
            )}
          </button>
        )}

        {!collapsed && isConfigOpen && visibleConfigItems.length > 0 && (
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
            className={`${GROUP_TOGGLE} ${collapsed ? "justify-center" : ""}`}
            onClick={() => handleGroupToggle(isAdminOpen, setIsAdminOpen)}
            aria-expanded={isAdminOpen}
            title={collapsed ? "System Administration" : undefined}
          >
            <SettingsIcon size={17} />
            {!collapsed && <span className="flex-1">System Administration</span>}
            {!collapsed && (
              <span className={chevronClasses(isAdminOpen)}>
                <ChevronDownIcon size={14} />
              </span>
            )}
          </button>
        )}

        {!collapsed && isAdminOpen && visibleAdminItems.length > 0 && (
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
