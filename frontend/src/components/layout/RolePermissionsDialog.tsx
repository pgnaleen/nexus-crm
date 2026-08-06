"use client";

import { useEffect, useState, useMemo } from "react";
import { RbacRiskLevel } from "@orelia/common";
import type { RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { assignRoleResources, getRoleResourceIds } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SearchIcon, ShieldIcon } from "@/components/ui/icons";

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

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <ShieldIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">Permissions</span>
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
          {role.name}
        </span>
      </div>
    </div>
  );

  return (
<<<<<<< Updated upstream
    <Dialog open title={`Permissions — ${role.name}`} onClose={onClose} maxWidth="850px">
      {formError && <p className="field-error">{formError}</p>}
=======
    <Dialog open title={dialogTitle} onClose={onClose} maxWidth="850px">
      {formError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{formError}</p>}
>>>>>>> Stashed changes

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
                    <span>{prefix}</span>
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
                      <span>{resource.name.replace(`${prefix}:`, '')}</span>
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
