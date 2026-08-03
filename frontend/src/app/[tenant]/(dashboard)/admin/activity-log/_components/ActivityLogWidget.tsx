"use client";

import { useMemo, useState } from "react";
import { AuthEventType } from "@orelia/common";
import type { AuditLogEntryResponse, AuthEventResponse } from "@orelia/common";
import { PageTabs } from "@/components/ui/PageTabs";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { formatDateTime, wallClockToUtc } from "@/lib/format-datetime";
import { entityLabel, renderAuditEntry } from "./changes-renderer";
import { MOCK_AUDIT_ENTRIES, MOCK_AUTH_EVENTS } from "./mock-data";

// Local-state pagination/filtering for the mock-first review pass -- the
// real backend endpoints (/activity-log/audit, /activity-log/auth) apply
// the identical filters server-side once wired (spec-activity-log.md
// section C). Kept at 10/page here purely so the mock data set (12/6 rows)
// demonstrates pagination without needing a much larger fixture.
const PAGE_SIZE = 10;

function actorDisplayName(actorId: string | null, actorName: string | null, isPlatform: boolean): string {
  if (isPlatform) return t("activityLog.actor.platform");
  if (!actorId || !actorName) return t("activityLog.actor.unknown");
  return actorName;
}

interface FilterState {
  from: string;
  to: string;
  actorId: string;
  module: string;
  search: string;
}

const EMPTY_FILTERS: FilterState = { from: "", to: "", actorId: "", module: "", search: "" };

function hasActiveFilters(filters: FilterState): boolean {
  return Object.values(filters).some((value) => value !== "");
}

function FilterBar({
  filters,
  onChange,
  actorOptions,
  moduleOptions,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  actorOptions: { value: string; label: string }[];
  moduleOptions: { value: string; label: string }[] | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
      <div className="relative w-[220px]">
        <span className="pointer-events-none absolute top-1/2 left-[10px] -translate-y-1/2 text-[var(--color-text-muted)]">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder={t("activityLog.filters.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">{t("activityLog.filters.from")}</label>
        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
          className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-[7px] font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">{t("activityLog.filters.to")}</label>
        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
          className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-[7px] font-[inherit] text-[13px] transition-colors duration-150 focus:border-crm-primary focus:outline-none"
        />
      </div>

      <div className="w-[180px]">
        <CustomSelect
          label=""
          value={filters.actorId}
          onChange={(value) => onChange({ ...filters, actorId: value })}
          options={[{ value: "", label: t("activityLog.filters.allActors") }, ...actorOptions]}
          fullWidth
        />
      </div>

      {moduleOptions && (
        <div className="w-[180px]">
          <CustomSelect
            label=""
            value={filters.module}
            onChange={(value) => onChange({ ...filters, module: value })}
            options={[{ value: "", label: t("activityLog.filters.allModules") }, ...moduleOptions]}
            fullWidth
          />
        </div>
      )}

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#f1f5f9]"
        >
          {t("activityLog.filters.clear")}
        </button>
      )}
    </div>
  );
}

function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-3 flex items-center justify-between text-[12.5px] text-[var(--color-text-muted)]">
      <span>{t("activityLog.pagination.showing", { from: String(from), to: String(to), total: String(total) })}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 font-medium transition-colors duration-150 hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("activityLog.pagination.previous")}
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 font-medium transition-colors duration-150 hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("activityLog.pagination.next")}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{hasFilters ? t("activityLog.emptyState.noMatch") : t("activityLog.emptyState.noneYet")}</p>
    </div>
  );
}

function matchesDateRange(occurredAt: string, filters: FilterState): boolean {
  const time = new Date(occurredAt).getTime();
  if (filters.from && time < new Date(wallClockToUtc(filters.from)).getTime()) return false;
  if (filters.to && time > new Date(wallClockToUtc(filters.to)).getTime()) return false;
  return true;
}

function AuditLogPanel() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of MOCK_AUDIT_ENTRIES) {
      if (entry.actorId && entry.actorName && !entry.actorIsPlatform) seen.set(entry.actorId, entry.actorName);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const moduleOptions = useMemo(() => {
    const seen = new Set(MOCK_AUDIT_ENTRIES.map((entry) => entry.entityType));
    return [...seen].map((value) => ({ value, label: entityLabel(value) })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const filtered = useMemo(() => {
    return MOCK_AUDIT_ENTRIES.filter((entry) => {
      if (!matchesDateRange(entry.occurredAt, filters)) return false;
      if (filters.actorId && entry.actorId !== filters.actorId) return false;
      if (filters.module && entry.entityType !== filters.module) return false;
      if (filters.search) {
        const haystack = `${entry.actorName ?? ""} ${entry.entityType} ${JSON.stringify(entry.changes ?? {})}`.toLowerCase();
        if (!haystack.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : a.id < b.id ? 1 : -1));
  }, [filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateFilters(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div>
      <FilterBar filters={filters} onChange={updateFilters} actorOptions={actorOptions} moduleOptions={moduleOptions} />

      {pageRows.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters(filters)} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="w-8 border-b border-[var(--color-border)] px-3 py-2.5" aria-hidden="true" />
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.when")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.actor")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.activity")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((entry) => {
                const rendered = renderAuditEntry(entry.action, entry.entityType, entry.changes);
                const isExpanded = expandedId === entry.id;
                return (
                  <>
                    <tr
                      key={entry.id}
                      className="cursor-pointer transition-colors duration-150 hover:bg-[#f7f8fc]"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <td className="border-b border-[var(--color-border)] p-3 text-[var(--color-text-muted)]">
                        {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                      </td>
                      <td className="border-b border-[var(--color-border)] p-3 whitespace-nowrap text-crm-text">
                        {formatDateTime(entry.occurredAt)}
                      </td>
                      <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                        {actorDisplayName(entry.actorId, entry.actorName, entry.actorIsPlatform)}
                      </td>
                      <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{rendered.headline}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={4} className="border-b border-[var(--color-border)] bg-[#f8fafc] p-4">
                          {rendered.lines.length > 0 && (
                            <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                              {rendered.lines.map((line) => (
                                <div key={line.key} className="flex justify-between gap-3 text-[12.5px]">
                                  <span className="text-[var(--color-text-muted)]">{line.label}</span>
                                  <span className="text-right text-crm-text">{line.detail}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <details>
                            <summary className="cursor-pointer text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                              {t("activityLog.detail.rawData")}
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white p-3 text-[11px]">
                              {JSON.stringify(entry.changes, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} total={filtered.length} onChange={setPage} />
    </div>
  );
}

function AuthEventsPanel() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const event of MOCK_AUTH_EVENTS) {
      if (event.userId) seen.set(event.userId, event.usernameAttempted);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const filtered = useMemo(() => {
    return MOCK_AUTH_EVENTS.filter((event) => {
      if (!matchesDateRange(event.occurredAt, filters)) return false;
      if (filters.actorId && event.userId !== filters.actorId) return false;
      if (filters.search && !event.usernameAttempted.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : a.id < b.id ? 1 : -1));
  }, [filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateFilters(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div>
      <FilterBar filters={filters} onChange={updateFilters} actorOptions={actorOptions} moduleOptions={null} />

      {pageRows.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters(filters)} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.when")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.actor")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.eventType")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.reason")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.ipAddress")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.userAgent")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((event) => (
                <tr key={event.id} className="transition-colors duration-150 hover:bg-[#f7f8fc]">
                  <td className="border-b border-[var(--color-border)] p-3 whitespace-nowrap text-crm-text">
                    {formatDateTime(event.occurredAt)}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{event.usernameAttempted}</td>
                  <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                    {event.eventType === AuthEventType.AccountLocked ? (
                      <span className="inline-flex items-center rounded-full bg-[#fdf0ee] px-2 py-0.5 text-[11px] font-bold text-[#c0392b]">
                        {t(`activityLog.eventTypes.${event.eventType}`)}
                      </span>
                    ) : event.eventType === AuthEventType.LoginFailed ? (
                      <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#b8860b]">
                        {t(`activityLog.eventTypes.${event.eventType}`)}
                      </span>
                    ) : (
                      t(`activityLog.eventTypes.${event.eventType}`)
                    )}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 text-[var(--color-text-muted)]">
                    {event.reason ? t(`activityLog.reasons.${event.reason}`) : "—"}
                  </td>
                  <td className="border-b border-[var(--color-border)] p-3 font-mono text-[12px] text-[var(--color-text-muted)]">
                    {event.ipAddress ?? "—"}
                  </td>
                  <td className="max-w-[220px] truncate border-b border-[var(--color-border)] p-3 text-[12px] text-[var(--color-text-muted)]" title={event.userAgent ?? undefined}>
                    {event.userAgent ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} total={filtered.length} onChange={setPage} />
    </div>
  );
}

export function ActivityLogWidget({ permissions: _permissions }: { permissions: string[] }) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 flex flex-col">
        <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{t("activityLog.title")}</h1>
        <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("activityLog.subtitle")}</p>
      </div>
      <p className="mb-6 text-[12px] text-[var(--color-text-muted)] italic">{t("activityLog.disclaimer")}</p>

      <PageTabs
        tabs={[
          { id: "audit", label: t("activityLog.tabs.auditLog"), panel: <AuditLogPanel /> },
          { id: "auth", label: t("activityLog.tabs.authEvents"), panel: <AuthEventsPanel /> },
        ]}
      />
    </div>
  );
}
