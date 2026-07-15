"use client";

import { useEffect, useState } from "react";
import type { RbacResourceResponse, RbacRoleResponse } from "@orelia/common";
import { assignRoleResources, getRoleResourceIds } from "@/lib/api/roles";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface RolePermissionsDialogProps {
  role: RbacRoleResponse;
  resources: RbacResourceResponse[];
  onClose: () => void;
  onSaved: (role: RbacRoleResponse) => void;
}

function groupByPrefix(resources: RbacResourceResponse[]): Map<string, RbacResourceResponse[]> {
  const groups = new Map<string, RbacResourceResponse[]>();
  for (const resource of resources) {
    const prefix = resource.name.split(":")[0];
    const group = groups.get(prefix) ?? [];
    group.push(resource);
    groups.set(prefix, group);
  }
  return groups;
}

export function RolePermissionsDialog({ role, resources, onClose, onSaved }: RolePermissionsDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const groups = groupByPrefix(resources);

  return (
    <Dialog open title={`Permissions — ${role.name}`} onClose={onClose}>
      {formError && <p className="field-error">{formError}</p>}

      {isLoading ? (
        <div className="dialog-loading">
          <Spinner size={28} />
        </div>
      ) : (
        <div className="permissions-list">
          {Array.from(groups.entries()).map(([prefix, groupResources]) => (
            <div key={prefix} className="permissions-group">
              <p className="permissions-group-title">{prefix}</p>
              {groupResources.map((resource) => (
                <label key={resource.id} className="permissions-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(resource.id)}
                    onChange={() => toggle(resource.id)}
                    disabled={isSaving}
                  />
                  <span>{resource.name}</span>
                  {resource.isPlatformOnly && <span className="permissions-platform-tag">platform</span>}
                </label>
              ))}
            </div>
          ))}
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
