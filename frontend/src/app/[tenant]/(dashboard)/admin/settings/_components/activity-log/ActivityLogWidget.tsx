"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthEventType } from "@orelia/common";
import type {
  ActivityLogFilterOptionsResponse,
  ActivityLogQuery,
  AuditLogEntryResponse,
  AuthEventResponse,
} from "@orelia/common";
import { getActivityLogFilterOptions, getAuditLog, getAuthEvents } from "@/lib/api/activity-log";
import { ApiError } from "@/lib/api/client";
import { PageTabs } from "@/components/ui/PageTabs";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { formatDateTime, wallClockToUtc } from "@/lib/format-datetime";
import { entityLabel, renderAuditEntry } from "./changes-renderer";

// Server-side pagination/filtering against the real /activity-log/audit and
// /activity-log/auth endpoints (spec-activity-log.md section C) -- the mock
// data set this widget used during the review pass is gone now that the
// backend is real. Kept at 10/page to match the mock-first pass's own page
// size.
const PAGE_SIZE = 10;
// A search/date-range edit fires on every keystroke -- debounced so typing
// "acme" doesn't fire 4 requests, only the one after the user pauses.
const FILTER_DEBOUNCE_MS = 350;

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
  // Only ever meaningful/shown for a System-tenant viewer -- see
  // ActivityLogWidget's own comment on isPlatformSession below.
  tenantId: string;
}

const EMPTY_FILTERS: FilterState = { from: "", to: "", actorId: "", module: "", search: "", tenantId: "" };

function hasActiveFilters(filters: FilterState): boolean {
  return Object.values(filters).some((value) => value !== "");
}

// Shared by both panels and the filter-options fetch -- from/to/actorId/
// search/tenant scoping is identical for the audit log and auth events
// queries, only `modules` (audit-only) differs per caller.
function baseQueryFromFilters(filters: FilterState, isPlatformSession: boolean): ActivityLogQuery {
  const query: ActivityLogQuery = {};
  if (filters.from) query.from = wallClockToUtc(filters.from);
  if (filters.to) query.to = wallClockToUtc(filters.to);
  if (filters.actorId) query.actorId = filters.actorId;
  if (filters.search) query.search = filters.search;
  // Cross-tenant viewing is only ever honored server-side for a genuine
  // System-tenant session regardless of what's sent here -- see
  // ActivityLogService.applyTenantScope. A platform viewer defaults to every
  // tenant's rows unless they've narrowed to one via the Tenant filter.
  if (isPlatformSession) {
    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    } else {
      query.allTenants = true;
    }
  }
  return query;
}

function useActivityLogFilterOptions(
  filters: Pick<FilterState, "from" | "to" | "tenantId">,
  isPlatformSession: boolean,
): ActivityLogFilterOptionsResponse | null {
  const [options, setOptions] = useState<ActivityLogFilterOptionsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = baseQueryFromFilters({ ...EMPTY_FILTERS, ...filters }, isPlatformSession);
    getActivityLogFilterOptions({ from: query.from, to: query.to, allTenants: query.allTenants, tenantId: query.tenantId })
      .then((result) => {
        if (!cancelled) setOptions(result);
      })
      .catch(() => {
        // Filter options are a convenience, not the primary data -- a failed
        // fetch just leaves dropdowns showing "All" options, never blocks
        // the table itself from loading.
        if (!cancelled) setOptions(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.tenantId, isPlatformSession]);

  return options;
}

function FilterBar({
  filters,
  onChange,
  actorOptions,
  moduleOptions,
  tenantOptions,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  actorOptions: { value: string; label: string }[];
  moduleOptions: { value: string; label: string }[] | null;
  tenantOptions: { value: string; label: string }[] | null;
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

      {tenantOptions && (
        <div className="w-[180px]">
          <CustomSelect
            label=""
            value={filters.tenantId}
            onChange={(value) => onChange({ ...filters, tenantId: value })}
            options={[{ value: "", label: t("activityLog.filters.allTenants") }, ...tenantOptions]}
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

function LoadingState() {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{t("activityLog.loading")}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title text-[var(--color-danger)]">{message}</p>
    </div>
  );
}

function AuditLogPanel({ isPlatformSession, currentTenantId: _currentTenantId }: { isPlatformSession: boolean; currentTenantId: string }) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<AuditLogEntryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useActivityLogFilterOptions(filters, isPlatformSession);

  const actorOptions = useMemo(
    () => (filterOptions?.actors ?? []).map((actor) => ({ value: actor.id, label: actor.name })),
    [filterOptions],
  );
  const moduleOptions = useMemo(
    () => (filterOptions?.modules ?? []).map((m) => ({ value: m.value, label: entityLabel(m.value) })).sort((a, b) => a.label.localeCompare(b.label)),
    [filterOptions],
  );
  const tenantOptions = useMemo(
    () => (isPlatformSession ? (filterOptions?.tenants ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name })) : null),
    [filterOptions, isPlatformSession],
  );

  useEffect(() => {
    let cancelled = false;
    const query: ActivityLogQuery = {
      ...baseQueryFromFilters(filters, isPlatformSession),
      page,
      pageSize: PAGE_SIZE,
      modules: filters.module ? [filters.module] : undefined,
    };
    const handle = setTimeout(() => {
      setIsLoading(true);
      setError(null);
      getAuditLog(query)
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setTotal(result.total);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : t("activityLog.errors.loadFailed"));
          setItems([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, FILTER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, isPlatformSession]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columnCount = isPlatformSession ? 5 : 4;

  function updateFilters(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        actorOptions={actorOptions}
        moduleOptions={moduleOptions}
        tenantOptions={tenantOptions}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
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
                {isPlatformSession && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                    {t("activityLog.table.tenant")}
                  </th>
                )}
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.actor")}
                </th>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.activity")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => {
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
                      {isPlatformSession && (
                        <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{entry.tenantName}</td>
                      )}
                      <td className="border-b border-[var(--color-border)] p-3 text-crm-text">
                        {actorDisplayName(entry.actorId, entry.actorName, entry.actorIsPlatform)}
                      </td>
                      <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{rendered.headline}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={columnCount} className="border-b border-[var(--color-border)] bg-[#f8fafc] p-4">
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

      <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
    </div>
  );
}

function AuthEventsPanel({ isPlatformSession, currentTenantId: _currentTenantId }: { isPlatformSession: boolean; currentTenantId: string }) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuthEventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useActivityLogFilterOptions(filters, isPlatformSession);

  const actorOptions = useMemo(
    () => (filterOptions?.actors ?? []).map((actor) => ({ value: actor.id, label: actor.name })),
    [filterOptions],
  );
  const tenantOptions = useMemo(
    () => (isPlatformSession ? (filterOptions?.tenants ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name })) : null),
    [filterOptions, isPlatformSession],
  );

  useEffect(() => {
    let cancelled = false;
    const query: ActivityLogQuery = {
      ...baseQueryFromFilters(filters, isPlatformSession),
      page,
      pageSize: PAGE_SIZE,
    };
    const handle = setTimeout(() => {
      setIsLoading(true);
      setError(null);
      getAuthEvents(query)
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setTotal(result.total);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : t("activityLog.errors.loadFailed"));
          setItems([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, FILTER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, isPlatformSession]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateFilters(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        actorOptions={actorOptions}
        moduleOptions={null}
        tenantOptions={tenantOptions}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters(filters)} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                  {t("activityLog.table.when")}
                </th>
                {isPlatformSession && (
                  <th className="border-b border-[var(--color-border)] px-3 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.03em] text-[var(--color-text-muted)] uppercase">
                    {t("activityLog.table.tenant")}
                  </th>
                )}
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
              {items.map((event) => (
                <tr key={event.id} className="transition-colors duration-150 hover:bg-[#f7f8fc]">
                  <td className="border-b border-[var(--color-border)] p-3 whitespace-nowrap text-crm-text">
                    {formatDateTime(event.occurredAt)}
                  </td>
                  {isPlatformSession && (
                    <td className="border-b border-[var(--color-border)] p-3 text-crm-text">{event.tenantName}</td>
                  )}
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

      <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
    </div>
  );
}

interface ActivityLogWidgetProps {
  permissions: string[];
  // True only for a genuine System-tenant session -- never for act-as-tenant
  // (that's a different, existing mechanism: TenantActingAsSwitcher lets a
  // System admin operate AS one tenant at a time across the whole app; this
  // is a separate, additional capability specific to this page -- viewing
  // every tenant's activity together, with an optional Tenant filter to
  // narrow it down). Deliberate scope addition beyond the original spec,
  // which deferred cross-tenant viewing entirely for v1.
  isPlatformSession: boolean;
  currentTenantId: string;
}

export function ActivityLogWidget({ permissions: _permissions, isPlatformSession, currentTenantId }: ActivityLogWidgetProps) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 flex flex-col">
        <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{t("activityLog.title")}</h1>
        <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{t("activityLog.subtitle")}</p>
      </div>
      <p className="mb-6 text-[12px] text-[var(--color-text-muted)] italic">{t("activityLog.disclaimer")}</p>

      <PageTabs
        tabs={[
          {
            id: "audit",
            label: t("activityLog.tabs.auditLog"),
            panel: <AuditLogPanel isPlatformSession={isPlatformSession} currentTenantId={currentTenantId} />,
          },
          {
            id: "auth",
            label: t("activityLog.tabs.authEvents"),
            panel: <AuthEventsPanel isPlatformSession={isPlatformSession} currentTenantId={currentTenantId} />,
          },
        ]}
      />
    </div>
  );
}
