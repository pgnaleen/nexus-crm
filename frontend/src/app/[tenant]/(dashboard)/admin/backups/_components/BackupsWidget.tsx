"use client";

import { useState } from "react";
import { PERMISSIONS } from "@orelia/common";
import { runBackup } from "@/lib/api/backups";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { useConfirm, useAlert } from "@/components/providers/DialogProvider";

interface BackupsWidgetProps {
  permissions: string[];
}

export function BackupsWidget({ permissions }: BackupsWidgetProps) {
  const [isRunning, setIsRunning] = useState(false);
  const confirm = useConfirm();
  const { showError, showSuccess } = useAlert();

  const canRun = permissions.includes(PERMISSIONS.BACKUP_CREATE);

  async function handleRun() {
    const ok = await confirm({
      title: "Run Database Backup",
      message:
        "This dumps the entire database and uploads it to S3 immediately, separate from tonight's automatic backup. It may take a moment. Continue?",
      confirmLabel: "Run Backup",
    });
    if (!ok) return;

    setIsRunning(true);
    try {
      await runBackup();
      showSuccess("Backup completed and uploaded.");
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Backup failed");
    } finally {
      setIsRunning(false);
    }
  }

  if (!canRun) {
    return null;
  }

  return (
    <div className="tenant-management-wrapper">
      <div className="funnel-header-top">
        <div className="funnel-header-left">
          <h1 className="funnel-title">Database Backups</h1>
          <p className="funnel-subtitle">
            The full database is backed up automatically every night. Use this to trigger an extra backup on demand.
          </p>
        </div>
      </div>

      <div className="content-card">
        <Button type="button" isLoading={isRunning} onClick={handleRun}>
          Run Backup Now
        </Button>
      </div>
    </div>
  );
}
