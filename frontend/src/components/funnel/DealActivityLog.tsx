"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { DealActivityLogEntryResponse } from "@orelia/common";
import { listDealActivityLog } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";

interface DealActivityLogProps {
  dealId: string;
}

interface ActionIconProps {
  size?: number;
}

const MAX_VISIBLE_CHANGES = 4;

const ACTION_ICON: Record<DealActivityLogEntryResponse["action"], ComponentType<ActionIconProps>> = {
  insert: PlusIcon,
  update: EditIcon,
  delete: TrashIcon,
};

// Badge-style status indicator per CLAUDE.md's design system (crm-primary
// confined to primary actions/badges) -- update reuses the same tint the
// stage roadmap uses for its own badges; delete uses the danger token
// already used for error text elsewhere in this dialog; insert stays neutral.
const ACTION_ICON_WRAP_CLASS: Record<DealActivityLogEntryResponse["action"], string> = {
  insert: "bg-[#f1f5f9] text-[var(--color-text-muted)]",
  update: "bg-crm-primary-tint text-crm-primary",
  delete: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function fieldLabel(key: string): string {
  const label = t(`dealActivityLog.fields.${key}`);
  // t() falls back to the raw key when a mapping doesn't exist -- degrade
  // that to a humanised version rather than showing the dotted lookup path.
  if (label === `dealActivityLog.fields.${key}`) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }
  return label;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return t("dealActivityLog.noValue");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length === 0 ? t("dealActivityLog.noValue") : `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ActivityEntryCard({ entry }: { entry: DealActivityLogEntryResponse }) {
  const [expanded, setExpanded] = useState(false);

  const actorName = entry.actorName ?? t("dealActivityLog.actorUnknown");
  const changedKeys = entry.action === "update" && entry.changes ? Object.keys(entry.changes) : [];
  const visibleKeys = expanded ? changedKeys : changedKeys.slice(0, MAX_VISIBLE_CHANGES);
  const hiddenCount = changedKeys.length - visibleKeys.length;
  const Icon = ACTION_ICON[entry.action];

  return (
    <div className="flex gap-3">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${ACTION_ICON_WRAP_CLASS[entry.action]}`}
        aria-hidden="true"
      >
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[13.5px] text-[var(--color-text)]">
            <span className="font-semibold">{actorName}</span> {t(`dealActivityLog.actionVerbs.${entry.action}`)}
          </span>
          <span className="text-[11.5px] text-[var(--color-text-muted)]" title={entry.occurredAt}>
            {formatDate(entry.occurredAt)}
          </span>
        </div>

        {visibleKeys.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {visibleKeys.map((key) => {
              const diff = (entry.changes as Record<string, { old: unknown; new: unknown }>)[key];
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-1.5 rounded-md bg-[var(--color-crm-bg)] px-2 py-1 text-[12px]"
                >
                  <span className="font-medium text-[var(--color-text)]">{fieldLabel(key)}</span>
                  <span className="text-[var(--color-text-muted)] line-through">{formatValue(diff?.old)}</span>
                  <span className="text-[var(--color-text-muted)]">→</span>
                  <span className="font-semibold text-[var(--color-text)]">{formatValue(diff?.new)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-medium text-crm-primary hover:underline"
          >
            {t("dealActivityLog.showMoreChanges", { count: hiddenCount, plural: hiddenCount === 1 ? "" : "s" })}
          </button>
        )}
      </div>
    </div>
  );
}

// Fetches and renders a deal's audit_logs trail (create/update/delete/
// status-change) as a "who did what, when" feed, newest-first. Sits alongside
// DealStageHistoryRoadmap in the same History tab -- that component covers
// stage moves only, this one covers everything else deals.service.ts records.
export function DealActivityLog({ dealId }: DealActivityLogProps) {
  const [entries, setEntries] = useState<DealActivityLogEntryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    listDealActivityLog(dealId)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("dealActivityLog.errors.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  return (
    <div className="mt-6 border-t border-[var(--color-border)] pt-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("dealActivityLog.heading")}</h3>

      {error && <p className="text-[12.5px] text-[var(--color-danger)]">{error}</p>}

      {!error && entries === null && (
        <p className="py-4 text-center text-[13.5px] text-[var(--color-text-muted)]">{t("dealActivityLog.loading")}</p>
      )}

      {!error && entries !== null && entries.length === 0 && (
        <p className="py-4 text-center text-[13.5px] text-[var(--color-text-muted)]">{t("dealActivityLog.empty")}</p>
      )}

      {!error && entries !== null && entries.length > 0 && (
        <div className="flex flex-col">
          {entries.map((entry) => (
            <ActivityEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
