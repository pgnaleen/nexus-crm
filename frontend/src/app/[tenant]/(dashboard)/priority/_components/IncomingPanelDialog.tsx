"use client";

import { useEffect, useState } from "react";
import { PriorityTaskQuadrant } from "@orelia/common";
import type { IncomingTaskResponse, PriorityTaskResponse, UserPickerResponse } from "@orelia/common";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { acceptPriorityTask, listIncomingPriorityTasks, redelegatePriorityTask } from "@/lib/api/priority-tasks";
import { ApiError } from "@/lib/api/client";
import { useAlert } from "@/components/providers/DialogProvider";
import { t } from "@/lib/i18n";
import { DelegateTaskDialog } from "./DelegateTaskDialog";
import { QUADRANT_ORDER } from "./types";

const QUADRANT_OPTIONS = QUADRANT_ORDER.map((quadrant) => ({
  value: quadrant,
  label: t(`priorityTracker.quadrants.${quadrant}.label`),
}));

interface IncomingPanelDialogProps {
  onClose: () => void;
  // Accepting a delegated task transfers ownership and drops it on the
  // board -- the board re-fetches so the new card (and the delegate-tracker
  // list) reflect it.
  onAccepted: (task: PriorityTaskResponse) => void;
  // Keeps the header's Incoming count in sync as items are actioned.
  onCountChange: (count: number) => void;
}

export function IncomingPanelDialog({ onClose, onAccepted, onCountChange }: IncomingPanelDialogProps) {
  const { showError } = useAlert();
  const [items, setItems] = useState<IncomingTaskResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Per-item chosen quadrant for the accept action ("" until picked).
  const [quadrantById, setQuadrantById] = useState<Record<string, PriorityTaskQuadrant>>({});
  const [redelegatingId, setRedelegatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listIncomingPriorityTasks()
      .then((fetched) => {
        if (cancelled) return;
        setItems(fetched);
        onCountChange(fetched.length);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : t("priorityTracker.incoming.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeItem(id: string) {
    setItems((current) => {
      const next = (current ?? []).filter((item) => item.id !== id);
      onCountChange(next.length);
      return next;
    });
  }

  async function handleAccept(item: IncomingTaskResponse) {
    const quadrant = quadrantById[item.id] ?? PriorityTaskQuadrant.Do;
    setBusyId(item.id);
    try {
      const task = await acceptPriorityTask(item.id, { quadrant });
      onAccepted(task);
      removeItem(item.id);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("priorityTracker.incoming.errors.acceptFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRedelegated(user: UserPickerResponse) {
    if (!redelegatingId) return;
    const id = redelegatingId;
    setBusyId(id);
    try {
      await redelegatePriorityTask(id, { userId: user.id });
      removeItem(id);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("priorityTracker.incoming.errors.redelegateFailed"));
    } finally {
      setBusyId(null);
      setRedelegatingId(null);
    }
  }

  return (
    <Dialog open title={t("priorityTracker.incoming.title")} onClose={onClose} maxWidth="600px">
      {loadError && <p className="mt-1.5 mb-3 text-[12.5px] text-[var(--color-danger)]">{loadError}</p>}

      {!items && !loadError && (
        <p className="text-sm text-[var(--color-text-muted)]">{t("priorityTracker.incoming.loading")}</p>
      )}

      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-[13px] font-medium text-crm-text">{t("priorityTracker.incoming.emptyTitle")}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("priorityTracker.incoming.emptyMessage")}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const isDelegated = item.kind === "delegated";
            return (
              <div key={item.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3.5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-crm-text">{item.title}</span>
                      <span
                        className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-[2px] text-[10.5px] font-semibold ${
                          isDelegated ? "bg-crm-primary-tint text-crm-primary" : "bg-[var(--color-bg)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {isDelegated ? t("priorityTracker.incoming.delegatedBadge") : t("priorityTracker.incoming.sharedBadge")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {t("priorityTracker.incoming.from", { name: item.fromName })}
                    </p>
                  </div>
                </div>

                {isDelegated ? (
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div className="w-[150px]">
                      <label className="mb-1 block text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                        {t("priorityTracker.incoming.placeInLabel")}
                      </label>
                      <CustomSelect
                        fullWidth
                        label=""
                        value={quadrantById[item.id] ?? PriorityTaskQuadrant.Do}
                        onChange={(val) =>
                          setQuadrantById((current) => ({ ...current, [item.id]: val as PriorityTaskQuadrant }))
                        }
                        options={QUADRANT_OPTIONS}
                      />
                    </div>
                    <Button type="button" onClick={() => handleAccept(item)} isLoading={busyId === item.id}>
                      {t("priorityTracker.incoming.acceptButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setRedelegatingId(item.id)}
                      disabled={busyId === item.id}
                    >
                      {t("priorityTracker.incoming.redelegateButton")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    {t("priorityTracker.incoming.sharedHint")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.actions.close")}
        </Button>
      </div>

      {redelegatingId && (
        <DelegateTaskDialog onClose={() => setRedelegatingId(null)} onDelegated={handleRedelegated} />
      )}
    </Dialog>
  );
}
