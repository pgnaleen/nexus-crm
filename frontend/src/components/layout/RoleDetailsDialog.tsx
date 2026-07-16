"use client";

import { useEffect, useState } from "react";
import type { RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { getRoleResourceIds } from "@/lib/api/roles";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { groupByPrefix } from "@/components/layout/RolePermissionsDialog";

interface RoleDetailsDialogProps {
  role: RbacRoleResponse;
  resources: RbacResourceResponse[];
  onClose: () => void;
}

export function RoleDetailsDialog({ role, resources, onClose }: RoleDetailsDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoleResourceIds(role.id)
      .then((ids) => {
        if (!cancelled) setGrantedIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setLoadError("Failed to load permissions for this role");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role.id]);

  const grantedResources = resources.filter((res) => grantedIds.has(res.id));
  const groups = groupByPrefix(grantedResources);

  return (
    <Dialog open title={`Role â€” ${role.name}`} onClose={onClose} maxWidth="720px">
      <div className="role-details-meta">
        <div className="role-details-meta-item">
          <span className="role-details-meta-label">Description</span>
          <span className="role-details-meta-value">{role.description || "â€”"}</span>
        </div>
        <div className="role-details-meta-item">
          <span className="role-details-meta-label">Permissions granted</span>
          <span className="role-details-meta-value">{grantedResources.length}</span>
        </div>
      </div>

      {loadError && <p className="field-error">{loadError}</p>}

      {isLoading ? (
        <div className="dialog-loading">
          <Spinner size={28} />
        </div>
      ) : groups.size === 0 ? (
        <div className="permissions-empty">This role has no permissions assigned yet.</div>
      ) : (
        <div className="permissions-grid role-details-grid">
          {Array.from(groups.entries()).map(([prefix, groupResources]) => (
            <div key={prefix} className="permissions-group">
              <div className="permissions-group-header">
                <span className="role-details-group-title">{prefix}</span>
                <span className="permissions-group-count">{groupResources.length}</span>
              </div>
              <div className="permissions-group-items">
                {groupResources.map((resource) => (
                  <div key={resource.id} className="permissions-view-row">
                    <span className="role-details-check" aria-hidden="true">
                      âœ“
                    </span>
                    <span>{resource.name.replace(`${prefix}:`, "")}</span>
                    <span className={`permissions-risk-tag permissions-risk-tag--${resource.riskLevel}`}>
                      {resource.riskLevel}
                    </span>
                    {resource.isPlatformOnly && <span className="permissions-platform-tag">platform</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dialog-actions">
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
