"use client";

import { useEffect, useState, useMemo } from "react";
import { RbacRiskLevel } from "@orelia/common";
import type { RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { assignRoleResources, getRoleResourceIds } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SearchIcon } from "@/components/ui/icons";

interface RolePermissionsDialogProps {
  role: RbacRoleResponse;
  resources: RbacResourceResponse[];
  onClose: () => void;
  onSaved: (role: RbacRoleResponse) => void;
}

export function groupByPrefix(resources: RbacResourceResponse[]): Map<string, RbacResourceResponse[]> {
  const groups = new Map<string, RbacResourceResponse[]>();
  for (const resource of resources) {
    const prefix = resource.name.split(":")[0];
    const group = groups.get(prefix) ?? [];
    group.push(resource);
    groups.set(prefix, group);
  }
  // Sort groups alphabetically
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

// Permission keys are raw, un-cased snake_case prefixes (e.g. "deals", "main_stage") -- this is
// the only place a friendlier admin-facing name is applied; the underlying key/DB value is
// unchanged, so nothing else needs to know about this mapping. "deals" -> "Funnel" specifically
// because that's what this feature is called everywhere else in the product.
const RESOURCE_DISPLAY_NAME: Record<string, string> = {
  platform: "Platform",
  tenants: "Tenants",
  users: "Users",
  rbac: "Roles",
  teams: "Teams",
  companies: "Companies",
  contacts: "Contacts",
  deals: "Funnel",
  deal_stages: "Deal Stages",
  relationship_type: "Relationship Types",
  relationship: "Relationships",
  deal_source: "Deal Sources",
  main_stage: "Main Stages",
  department: "Departments",
  sub_stage: "Sub Stages",
};

// Action suffix -> display label. The underlying permission key stays "_update" (renaming ~40
// existing keys to "_edit" across the whole backend would be a much larger, riskier change for
// a purely cosmetic difference) -- this mapping is what actually shows "Edit" in the UI, matching
// the supervisor's View/Create/Edit/Delete wording without touching the DB-level key names.
const ACTION_DISPLAY_NAME: Record<string, string> = {
  view: "View",
  read: "View", // legacy naming on a few resources, same meaning as "view"
  create: "Create",
  update: "Edit",
  delete: "Delete",
  manage: "Manage", // being phased out; still shown as-is for any role that still holds one
  disable: "Disable",
  "stage:update": "Move Stage",
  "impersonate-tenant": "Impersonate Tenant",
};

function displayNameForPrefix(prefix: string): string {
  return RESOURCE_DISPLAY_NAME[prefix] ?? prefix;
}

function displayNameForAction(prefix: string, fullName: string): string {
  const action = fullName.slice(prefix.length + 1);
  return ACTION_DISPLAY_NAME[action] ?? action;
}

type LevelFilter = "all" | "tenant" | "platform";
type RiskFilter = "all" | RbacRiskLevel;

const RISK_LABELS: Record<RbacRiskLevel, string> = {
  [RbacRiskLevel.Low]: "Low",
  [RbacRiskLevel.Medium]: "Medium",
  [RbacRiskLevel.High]: "High",
  [RbacRiskLevel.Critical]: "Critical",
};

export function RolePermissionsDialog({ role, resources, onClose, onSaved }: RolePermissionsDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New filters
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");

  useEffect(() => {
    let cancelled = false;
    getRoleResourceIds(role.id)
      .then((ids) => {
        if (!cancelled) setSelectedIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setFormError("Failed to load current permissions");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role.id]);

  function toggle(resourceId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });
  }

  function toggleGroup(groupResources: RbacResourceResponse[], isAllSelected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const res of groupResources) {
        if (isAllSelected) {
          next.delete(res.id);
        } else {
          next.add(res.id);
        }
      }
      return next;
    });
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  async function handleSave() {
    setFormError(null);
    setIsSaving(true);
    try {
      const saved = await assignRoleResources(role.id, { resourceIds: Array.from(selectedIds) });
      onSaved(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  }

  // Filter resources based on search and level before grouping
  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      // Level filter
      if (levelFilter === "platform" && !res.isPlatformOnly) return false;
      if (levelFilter === "tenant" && res.isPlatformOnly) return false;

      // Risk filter
      if (riskFilter !== "all" && res.riskLevel !== riskFilter) return false;

      // Search filter
      if (search && !res.name.toLowerCase().includes(search.toLowerCase())) return false;

      return true;
    });
  }, [resources, search, levelFilter, riskFilter]);

  const groups = useMemo(() => groupByPrefix(filteredResources), [filteredResources]);

  return (
    <Dialog open title={`Permissions — ${role.name}`} onClose={onClose} maxWidth="850px">
      {formError && <p className="field-error">{formError}</p>}

      {!isLoading && (
        <div className="permissions-controls">
          <div className="permissions-search">
            <SearchIcon size={16} />
            <input 
              type="text" 
              placeholder="Search permissions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="permissions-filters-right">
            <select
              className="permissions-filter-select"
              aria-label="Filter by level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            >
              <option value="all">All Levels</option>
              <option value="tenant">Tenant Only</option>
              <option value="platform">Platform Only</option>
            </select>

            <select
              className="permissions-filter-select"
              aria-label="Filter by risk level"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            >
              <option value="all">All Risk Levels</option>
              {Object.values(RbacRiskLevel).map((level) => (
                <option key={level} value={level}>
                  {RISK_LABELS[level]}
                </option>
              ))}
            </select>

            <button type="button" className="permissions-clear-all" onClick={clearAll}>
              Clear all
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="dialog-loading">
          <Spinner size={28} />
        </div>
      ) : (
        <div className="permissions-grid">
          {Array.from(groups.entries()).map(([prefix, groupResources]) => {
            const isAllSelected = groupResources.every(res => selectedIds.has(res.id));
            const isSomeSelected = groupResources.some(res => selectedIds.has(res.id));
            
            return (
              <div key={prefix} className="permissions-group">
                <div className="permissions-group-header">
                  <label className="permissions-group-title">
                    <input 
                      type="checkbox" 
                      checked={isAllSelected}
                      ref={input => {
                        if (input) input.indeterminate = isSomeSelected && !isAllSelected;
                      }}
                      onChange={() => toggleGroup(groupResources, isAllSelected)}
                      disabled={isSaving}
                    />
                    <span>{displayNameForPrefix(prefix)}</span>
                  </label>
                  <span className="permissions-group-count">
                    {groupResources.filter(res => selectedIds.has(res.id)).length} / {groupResources.length}
                  </span>
                </div>
                
                <div className="permissions-group-items">
                  {groupResources.map((resource) => (
                    <label key={resource.id} className="permissions-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(resource.id)}
                        onChange={() => toggle(resource.id)}
                        disabled={isSaving}
                      />
                      <span>{displayNameForAction(prefix, resource.name)}</span>
                      <span className={`permissions-risk-tag permissions-risk-tag--${resource.riskLevel}`}>
                        {resource.riskLevel}
                      </span>
                      {resource.isPlatformOnly && <span className="permissions-platform-tag">platform</span>}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {groups.size === 0 && (
            <div className="permissions-empty">
              No permissions match your current filters.
            </div>
          )}
        </div>
      )}

      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="button" isLoading={isSaving} disabled={isLoading} onClick={handleSave}>
          Save permissions
        </Button>
      </div>
    </Dialog>
  );
}
