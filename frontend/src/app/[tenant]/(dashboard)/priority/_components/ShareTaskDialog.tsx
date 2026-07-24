"use client";

import { useEffect, useState } from "react";
import type { PriorityTaskShareResponse, UserPickerResponse } from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { listUsersPicker } from "@/lib/api/pickers";
import { createPriorityTaskShare } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";

// Story 1.5 (Share a Task) -- fully wired. The user picker (GET
// /pickers/users) and the share itself (POST /priority-tasks/:id/shares)
// are both real.

interface ShareTaskDialogProps {
  taskId: string;
  alreadySharedWithIds: string[];
  onClose: () => void;
  onShared: (share: PriorityTaskShareResponse) => void;
}

export function ShareTaskDialog({ taskId, alreadySharedWithIds, onClose, onShared }: ShareTaskDialogProps) {
  const [users, setUsers] = useState<UserPickerResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectError, setSelectError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listUsersPicker()
      .then((fetched) => {
        if (!cancelled) setUsers(fetched);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.shareDialog.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options: SearchSelectOption[] = (users ?? [])
    .filter((u) => !alreadySharedWithIds.includes(u.id))
    .map((u) => ({ value: u.id, label: u.displayName }));

  async function handleShare() {
    if (!selectedUserId) {
      setSelectError(t("priorityTracker.shareDialog.errors.userRequired"));
      return;
    }
    setIsSaving(true);
    setLoadError(null);
    try {
      const share = await createPriorityTaskShare(taskId, { userId: selectedUserId });
      onShared(share);
      onClose();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.shareDialog.errors.loadFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open title={t("priorityTracker.shareDialog.title")} onClose={onClose} maxWidth="420px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      <div className="mb-[18px]">
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
          {t("priorityTracker.shareDialog.userLabel")}
        </label>
        {users && options.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-text-muted)]">{t("priorityTracker.shareDialog.noneAvailable")}</p>
        ) : (
          <SearchSelect
            value={selectedUserId}
            onChange={(val) => {
              setSelectedUserId(val);
              setSelectError(undefined);
            }}
            options={options}
            placeholder={t("priorityTracker.shareDialog.userPlaceholder")}
            searchPlaceholder={t("priorityTracker.shareDialog.searchPlaceholder")}
          />
        )}
        {selectError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{selectError}</p>}
      </div>

      <div className="mt-2 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="button" onClick={handleShare} disabled={options.length === 0} isLoading={isSaving}>
          {t("priorityTracker.shareDialog.shareButton")}
        </Button>
      </div>
    </Dialog>
  );
}
