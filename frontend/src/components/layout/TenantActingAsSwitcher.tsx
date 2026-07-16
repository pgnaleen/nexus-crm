"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActingTenant, TenantSummaryResponse } from "@orelia/common";
import { actAsTenant, exitActAsTenant } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface TenantActingAsSwitcherProps {
  tenants: TenantSummaryResponse[];
  currentTenantId: string;
  actingTenant: ActingTenant | null;
}

export function TenantActingAsSwitcher({ tenants, currentTenantId, actingTenant }: TenantActingAsSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Excludes the admin's own tenant -- switching "to" your own tenant isn't
  // a meaningful action, and staying on the same URL (never routing to the
  // target tenant's slug) is what keeps getServerSession from treating the
  // admin as logged out mid-switch.
  const selectableTenants = tenants.filter((tenant) => tenant.id !== currentTenantId);

  async function handleSelect(tenantId: string) {
    if (!tenantId) return;
    setError(null);
    try {
      await actAsTenant(tenantId);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to switch tenant");
    }
  }

  async function handleExit() {
    setError(null);
    try {
      await exitActAsTenant();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to exit acting-as mode");
    }
  }

  return (
    <div className="acting-as-switcher">
      {actingTenant ? (
        <div className="acting-as-banner">
          <span>
            Viewing as <strong>{actingTenant.name}</strong>
          </span>
          <button type="button" className="acting-as-exit-btn" onClick={handleExit} disabled={isPending}>
            Exit
          </button>
        </div>
      ) : (
        <CustomSelect
          label="Act as tenant"
          value=""
          onChange={handleSelect}
          options={[
            { value: "", label: "Select a tenant..." },
            ...selectableTenants.map((tenant) => ({ value: tenant.id, label: tenant.name })),
          ]}
        />
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
