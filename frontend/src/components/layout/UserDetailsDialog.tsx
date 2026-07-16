"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { UserResponse, UserSummaryResponse } from "@orelia/common";
import { getUser } from "@/lib/api/users";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { UserStatusBadge } from "@/components/ui/UserStatusBadge";

interface UserDetailsDialogProps {
  user: UserSummaryResponse;
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

// Pinned locale + timeZone -- see UsersTableWidget's formatLastLogin for why.
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
}

export function UserDetailsDialog({ user, onClose }: UserDetailsDialogProps) {
  const [detail, setDetail] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getUser(user.id)
      .then((full) => {
        if (!cancelled) setDetail(full);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Failed to load user details");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <Dialog open title="User Details" onClose={onClose}>
      {loadError && <p className="field-error">{loadError}</p>}

      {isLoading || !detail ? (
        <div className="dialog-loading">
          <Spinner size={28} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "16px" }}>
          <DetailItem label="Username" value={detail.username} />
          <DetailItem label="Display Name" value={detail.displayName} />

          <DetailItem label="Status" value={<UserStatusBadge status={detail.status} />} />
          <DetailItem label="Login Email" value={detail.loggingEmail} />

          <DetailItem
            label="Last Login"
            value={detail.lastLoggingAt ? formatDateTime(detail.lastLoggingAt) : null}
          />
          <DetailItem label="Failed Login Attempts" value={String(detail.loggingAttempts)} />

          <DetailItem
            label="Locked Until"
            value={detail.lockedUntil ? formatDateTime(detail.lockedUntil) : null}
          />
          <DetailItem label="Must Change Password" value={detail.mustChangePassword ? "Yes" : "No"} />
        </div>
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
