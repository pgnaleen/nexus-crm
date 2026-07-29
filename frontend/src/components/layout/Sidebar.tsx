"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { ChevronDownIcon, ChevronRightIcon, DashboardIcon, DealRegistrationIcon, FinanceIcon, FunnelIcon, LeadsIcon, LegalIcon, PriorityIcon, SettingsIcon, SlidersIcon, UsersGroupIcon, UserIcon, ActivityIcon } from "@/components/ui/icons";
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

// A group's sub-items (Main Stage names, Relationship Type names, admin
// resource names, ...) have no icons of their own, so the collapsed rail
// represents each one as a short uppercase abbreviation instead: 2 letters
// of a single word, or the initial of each of up to the first 3 words.
// Deterministic and label-driven (not a hand-maintained map), so a renamed
// tenant Relationship Type or Main Stage is abbreviated correctly with no
// code change. Two different names can land on the same abbreviation --
// the badge's `title` tooltip disambiguates on hover.
function abbreviateLabel(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = words;
  if (!first) return "?";
  if (rest.length === 0) return first.slice(0, 2).toUpperCase();
  return [first, ...rest]
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

const BADGE_LINK_BASE =
  "flex h-7 w-7 items-center justify-center rounded-md text-[10.5px] font-semibold uppercase tracking-tight text-white/60 no-underline transition-colors duration-150 hover:bg-white/10 hover:text-white";
const BADGE_LINK_ACTIVE = "bg-crm-primary text-white hover:bg-crm-primary hover:text-white";

function badgeClasses(isActive: boolean): string {
  return isActive ? `${BADGE_LINK_BASE} ${BADGE_LINK_ACTIVE}` : BADGE_LINK_BASE;
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

  // Shared by every group toggle (Deals/Relationships/HR/Config/Admin). Same
  // open/closed toggle whether collapsed or not -- while collapsed, "open"
  // reveals that group's sub-items as abbreviated badges in place, rather
  // than forcing the sidebar to expand.
  function handleGroupToggle(isOpen: boolean, setIsOpen: (value: boolean) => void) {
    setIsOpen(!isOpen);
  }

  const dashboardHref = `/${tenantSlug}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const priorityHref = `/${tenantSlug}/priority`;
  const isPriorityActive = pathname === priorityHref;

  const funnelHref = `/${tenantSlug}/funnel`;
  const isFunnelActive = pathname === funnelHref;

  // Placeholder root links -- pages exist (auth-only, same as Priority
  // Tracker) but render "Coming Soon" until each section's real
  // functionality is built. No RBAC permission exists for any of these
  // yet, so -- also like Priority Tracker -- there's nothing to gate on.
  const leadsHref = `/${tenantSlug}/leads`;
  const isLeadsActive = pathname === leadsHref;

  const dealRegistrationHref = `/${tenantSlug}/deal-registration`;
  const isDealRegistrationActive = pathname === dealRegistrationHref;

  const legalHref = `/${tenantSlug}/legal`;
  const isLegalActive = pathname === legalHref;

  const financeHref = `/${tenantSlug}/finance`;
  const isFinanceActive = pathname === financeHref;

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
        {/* Expanded shows the full lockup (mark + NEXUS); collapsing drops the
            wordmark and leaves the mark alone. Centred in the rail either way:
            the row is `relative` with the collapse chevron pinned right, since
            `justify-between` would drag the lockup off centre.

            The two sizes aren't a typo. `size` is the whole lockup's height,
            and the N occupies only ~63% of the horizontal one -- so 38 there
            renders an N about 24px tall, and 30 standalone keeps the collapsed
            mark close to that rather than ballooning. */}
        <div className={`flex items-center pt-2 pb-[26px] ${collapsed ? "flex-col gap-2" : "relative justify-center px-0.5"}`}>
          <NexusLogo variant={collapsed ? "mark" : "horizontal"} tone="light" size={collapsed ? 30 : 38} />
          <button
            type="button"
            onClick={() => setManualOverride(!collapsed)}
            className={`flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white ${
              collapsed ? "" : "absolute right-0.5"
            }`}
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

        {/* LEADS ROOT LINK (placeholder -- see const comment above) */}
        <Link
          href={leadsHref}
          className={`${linkClasses(isLeadsActive)} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleLinkClick(isLeadsActive)}
          title={collapsed ? "Leads" : undefined}
        >
          <LeadsIcon size={17} />
          {!collapsed && "Leads"}
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

            {collapsed && isDealsOpen && (
              <div className="mt-0.5 mb-1.5 flex flex-col items-center gap-1">
                {mainStages.map((stage) => {
                  const href = `/${tenantSlug}/deals/${stage.id}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={badgeClasses(isActive)}
                      onClick={() => handleLinkClick(isActive)}
                      title={stage.name}
                    >
                      {abbreviateLabel(stage.name)}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* DEAL REGISTRATION ROOT LINK (placeholder -- see const comment above) */}
        <Link
          href={dealRegistrationHref}
          className={`${linkClasses(isDealRegistrationActive)} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleLinkClick(isDealRegistrationActive)}
          title={collapsed ? "Deal Registration" : undefined}
        >
          <DealRegistrationIcon size={17} />
          {!collapsed && "Deal Registration"}
        </Link>

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

        {collapsed && isRelationshipsOpen && (
          <div className="mt-0.5 mb-1.5 flex flex-col items-center gap-1">
            {relationshipTypes.map((type) => {
              const href = `/${tenantSlug}/relationships/${type.id}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={badgeClasses(isActive)}
                  onClick={() => handleLinkClick(isActive)}
                  title={type.name}
                >
                  {abbreviateLabel(type.name)}
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

            {collapsed && isHROpen && (
              <div className="mt-0.5 mb-1.5 flex flex-col items-center gap-1">
                <Link
                  href={hrHref}
                  className={badgeClasses(isHrActive)}
                  onClick={() => handleLinkClick(isHrActive)}
                  title="Employees"
                >
                  {abbreviateLabel("Employees")}
                </Link>
                <Link
                  href={orgChartHref}
                  className={badgeClasses(isOrgChartActive)}
                  onClick={() => handleLinkClick(isOrgChartActive)}
                  title="Organization Chart"
                >
                  {abbreviateLabel("Organization Chart")}
                </Link>
                {canViewEmployees && (
                  <Link
                    href={certifiedHref}
                    className={badgeClasses(isCertifiedActive)}
                    onClick={() => handleLinkClick(isCertifiedActive)}
                    title="Certified Employees"
                  >
                    {abbreviateLabel("Certified Employees")}
                  </Link>
                )}
                {canReviewCertifications && (
                  <Link
                    href={certReviewHref}
                    className={badgeClasses(isCertReviewActive)}
                    onClick={() => handleLinkClick(isCertReviewActive)}
                    title="Certification Review"
                  >
                    {abbreviateLabel("Certification Review")}
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* LEGAL ROOT LINK (placeholder -- see const comment above) */}
        <Link
          href={legalHref}
          className={`${linkClasses(isLegalActive)} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleLinkClick(isLegalActive)}
          title={collapsed ? "Legal" : undefined}
        >
          <LegalIcon size={17} />
          {!collapsed && "Legal"}
        </Link>

        {/* FINANCE ROOT LINK (placeholder -- see const comment above) */}
        <Link
          href={financeHref}
          className={`${linkClasses(isFinanceActive)} ${collapsed ? "justify-center" : ""}`}
          onClick={() => handleLinkClick(isFinanceActive)}
          title={collapsed ? "Finance" : undefined}
        >
          <FinanceIcon size={17} />
          {!collapsed && "Finance"}
        </Link>

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

        {collapsed && isConfigOpen && visibleConfigItems.length > 0 && (
          <div className="mt-0.5 mb-1.5 flex flex-col items-center gap-1">
            {visibleConfigItems.map(({ label, segment, isRoot }) => {
              const href = isRoot ? `/${tenantSlug}/${segment}` : `${adminBasePath}${segment}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={badgeClasses(isActive)}
                  onClick={() => handleLinkClick(isActive)}
                  title={label}
                >
                  {abbreviateLabel(label)}
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

        {collapsed && isAdminOpen && visibleAdminItems.length > 0 && (
          <div className="mt-0.5 mb-1.5 flex flex-col items-center gap-1">
            {visibleAdminItems.map(({ label, segment, isRoot }) => {
              const href = isRoot ? `/${tenantSlug}/${segment}` : `${adminBasePath}${segment}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={badgeClasses(isActive)}
                  onClick={() => handleLinkClick(isActive)}
                  title={label}
                >
                  {abbreviateLabel(label)}
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
