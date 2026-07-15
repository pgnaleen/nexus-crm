"use client";

import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { EditIcon } from "../ui/Icons";
import { Tenant } from "@/types";

interface TenantDetailsDialogProps {
  open: boolean;
  tenant: Tenant | null;
  onClose: () => void;
}

export function TenantDetailsDialog({ open, tenant, onClose }: TenantDetailsDialogProps) {
  if (!tenant) return null;

  const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", color: "var(--color-text)", fontWeight: 500 }}>
        {value || "—"}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} title="Tenant Details">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "16px" }}>
        <DetailItem label="Name" value={tenant.name} />
        <DetailItem label="Slug" value={tenant.slug} />
        
        <DetailItem label="Status" value={<StatusBadge status={tenant.status} />} />
        <DetailItem label="Plan" value={tenant.planName} />
        
        <DetailItem label="Industry" value={tenant.industryName} />
        <DetailItem label="Phone" value={tenant.phone} />
        
        <DetailItem label="Contact Email" value={tenant.contactEmail} />
        <DetailItem label="Billing Email" value={tenant.billingEmail} />
      </div>

      <div style={{ marginTop: "8px" }}>
        <DetailItem label="Tagline" value={tenant.tagline} />
        <DetailItem label="Address" value={tenant.address} />
      </div>

      <div style={{ 
        display: "flex", 
        justifyContent: "flex-end", 
        marginTop: "32px",
        paddingTop: "16px",
        borderTop: "1px solid var(--color-border)"
      }}>
        <div style={{ width: "120px" }}>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
