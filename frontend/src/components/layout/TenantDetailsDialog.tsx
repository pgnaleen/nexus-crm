"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { TenantResponse, TenantSummaryResponse } from "@orelia/common";
import { getTenant } from "@/lib/api/tenants";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { StatusBadge } from "../ui/StatusBadge";

interface TenantDetailsDialogProps {
  open: boolean;
  tenant: TenantSummaryResponse | null;
  onClose: () => void;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", color: "var(--color-text)", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

export function TenantDetailsDialog({ open, tenant, onClose }: TenantDetailsDialogProps) {
  const [detail, setDetail] = useState<TenantResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getTenant(tenant.id)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Failed to load tenant details");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  if (!tenant) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Tenant Details">
      {loadError && <p className="field-error">{loadError}</p>}

      {isLoading || !detail ? (
        <div className="dialog-loading">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "16px" }}>
            <DetailItem label="Name" value={detail.name} />
            <DetailItem label="Slug" value={detail.slug} />

            <DetailItem label="Status" value={<StatusBadge status={detail.status} />} />
            <DetailItem label="Plan" value={detail.planName} />

            <DetailItem label="Industry" value={detail.industryName} />
            <DetailItem label="Phone" value={detail.phoneNo} />

            <DetailItem label="Contact Email" value={detail.contactEmail} />
            <DetailItem label="Billing Email" value={detail.billingEmail} />
          </div>

          <div style={{ marginTop: "8px" }}>
            <DetailItem label="Tagline" value={detail.tagline} />
            <DetailItem label="Address" value={detail.address} />
          </div>
        </>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <div style={{ width: "120px" }}>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
