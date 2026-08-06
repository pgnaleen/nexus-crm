"use client";

import { useEffect, useState } from "react";
import type { UserPickerResponse } from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";
import { listUsersPicker } from "@/lib/api/pickers";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { UserIcon } from "@/components/ui/icons";

// Story 1.6 (Delegate a Task) -- mock/local pass, matching how Story 1.5
// (Share) started. The user picker is real (GET /pickers/users, already
// wired), but the delegate action itself only calls back into local board
// state for now -- no priority_task_delegation_trackers table/endpoint
// exists yet (the two-phase delegate-then-accept flow also needs at least
// a slice of Story 1.8's Incoming panel to close the loop for real). Wired
// for real once this UI is signed off.

interface DelegateTaskDialogProps {
  onClose: () => void;
  onDelegated: (user: UserPickerResponse) => void;
}

export function DelegateTaskDialog({ onClose, onDelegated }: DelegateTaskDialogProps) {
  const [users, setUsers] = useState<UserPickerResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectError, setSelectError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    listUsersPicker()
      .then((fetched) => {
        if (!cancelled) setUsers(fetched);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.delegateDialog.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options: SearchSelectOption[] = (users ?? []).map((u) => ({ value: u.id, label: u.displayName }));
  const selectedUser = (users ?? []).find((u) => u.id === selectedUserId);

  function handleDelegate() {
    if (!selectedUser) {
      setSelectError(t("priorityTracker.delegateDialog.errors.userRequired"));
      return;
    }
    onDelegated(selectedUser);
    onClose();
  }

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <UserIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">{t("priorityTracker.delegateDialog.title")}</span>
      </div>
    </div>
  );

  return (
    <Dialog open title={dialogTitle} onClose={onClose} maxWidth="420px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      <div className="mb-[18px]">
        <label className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-muted)]">
          {t("priorityTracker.delegateDialog.userLabel")}
        </label>
        <SearchSelect
          value={selectedUserId}
          onChange={(val) => {
            setSelectedUserId(val);
            setSelectError(undefined);
          }}
          options={options}
          placeholder={t("priorityTracker.delegateDialog.userPlaceholder")}
          searchPlaceholder={t("priorityTracker.delegateDialog.searchPlaceholder")}
        />
        {selectError && <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{selectError}</p>}
      </div>

      {selectedUser && (
        <p className="mb-[18px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[12.5px] text-[var(--color-text-muted)]">
          {t("priorityTracker.delegateDialog.warning", { name: selectedUser.displayName })}
        </p>
      )}

      <div className="mt-2 flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="button" onClick={handleDelegate}>
          {t("priorityTracker.delegateDialog.delegateButton")}
        </Button>
      </div>
    </Dialog>
  );
}
