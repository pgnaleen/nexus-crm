"use client";

import { useEffect, useRef, useState } from "react";
import { type FunnelLead } from "@/lib/data/funnel";
import { PERMISSIONS } from "@orelia/common";
import type {
  CompanyPickerResponse,
  ContactPickerResponse,
  DealPartnerLinkResponse,
  DealResponse,
  DealSourceResponse,
  DepartmentPickerResponse,
  EmployeePickerResponse,
  IndustryResponse,
  RelationshipRolePickerResponse,
  RelationshipTypeResponse,
} from "@orelia/common";
import { FunnelBoard, type FunnelColumn } from "@/components/funnel/FunnelBoard";
import { AddDealDialog } from "@/components/funnel/AddDealDialog";
import { DealStageHistoryDialog } from "@/components/funnel/DealStageHistoryDialog";
import { ViewDealDialog } from "@/components/funnel/ViewDealDialog";
import { moveDeal } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/components/providers/ToastProvider";
import { useAlert, useConfirm } from "@/components/providers/DialogProvider";
import { BuildingIcon, SearchIcon, UserIcon } from "@/components/ui/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/SearchSelect";

/* ── Per-source accent colours ─────────────────────────────────
   Deal Sources are tenant-defined (created/renamed freely from Admin),
   so colors can't be keyed by name -- each source is assigned a slot by
   its stable position in `dealSources`, cycling past 8. Fixed hue order,
   never re-shuffled by filtering/sorting the tab list. */
const ALL_TAB_CONFIG = { accent: "#475569", bg: "#f1f5f9" };
const SOURCE_PALETTE: { accent: string; bg: string }[] = [
  { accent: "#2a78d6", bg: "#dbeafe" }, // blue
  { accent: "#008300", bg: "#dcfce7" }, // green
  { accent: "#e87ba4", bg: "#fce7f3" }, // magenta
  { accent: "#eda100", bg: "#fef3c7" }, // yellow
  { accent: "#1baf7a", bg: "#ccfbf1" }, // aqua
  { accent: "#eb6834", bg: "#ffedd5" }, // orange
  { accent: "#4a3aa7", bg: "#ede9fe" }, // violet
  { accent: "#e34948", bg: "#fee2e2" }, // red
];

// How long a stage move stays undoable before it's persisted to the backend.
const UNDO_GRACE_PERIOD_MS = 30000;

// Same "kind:id" value scheme AddDealDialog's Customer/Partner fields use
// (SearchSelect/MultiSelect only carry a single string value).
function parsePartyValue(value: string): { kind: "company" | "contact"; id: string } | null {
  const [kind, id] = value.split(":");
  if (kind !== "company" && kind !== "contact") return null;
  if (!id) return null;
  return { kind, id };
}

type StageField = "mainStageName" | "currentStageName";
type StageIdField = "mainStageId" | "currentStageId";

const STAGE_ID_FIELD: Record<StageField, StageIdField> = {
  mainStageName: "mainStageId",
  currentStageName: "currentStageId",
};

/* ── Convert a real Deal into the board's display shape ──────── */
// stageIdField selects which deal field drives the column a card lands in:
//   "mainStageId"    → funnel overview board (columns = Main Stages)
//   "currentStageId" → per-main-stage board  (columns = Sub Stages)
function dealToFunnelLead(deal: DealResponse, stageIdField: StageIdField): FunnelLead {
  return {
    id: deal.id,
    name: deal.name,
    company: deal.companyName ?? "",
    value: deal.estimatedValue ?? 0,
    stage: deal[stageIdField] ?? "",
    date: deal.expectedCloseDate ?? "",
    assignee: deal.ownerName ?? "Unassigned",
    code: deal.dealCode,
    country: deal.dealCountry ?? undefined,
    status: deal.status,
  };
}

interface PendingMove {
  toastId: string;
  // Snapshot of the deal's stage fields *before* any optimistic change in
  // this pending sequence -- kept across rapid re-drags of the same card so
  // Undo always lands on the last value actually saved in the backend.
  original: Pick<DealResponse, "mainStageId" | "mainStageName" | "currentStageId" | "currentStageName">;
}

interface FunnelSourceTabsProps {
  dealSources: DealSourceResponse[];
  columns: FunnelColumn[];
  // Sub Stage options for the Add Deal dialog, when they differ from the
  // board's own `columns` (e.g. the Funnel overview groups its board by Main
  // Stage, but a deal's currentStageId must be a real Sub Stage). Defaults to
  // `columns` when the board is already Sub-Stage-shaped. Also used to
  // resolve which Sub Stage a Main-Stage-grouped board should move a deal
  // into when it's dropped on a Main Stage column (see resolveTarget below).
  stageOptions?: FunnelColumn[];
  // Which deal field to use when matching a deal card into a board column:
  //   "mainStageName"    → funnel overview (Main Stage columns, default)
  //   "currentStageName" → per-main-stage board (Sub Stage columns)
  stageField?: StageField;
  companies: CompanyPickerResponse[];
  employees: EmployeePickerResponse[];
  contacts: ContactPickerResponse[];
  departments: DepartmentPickerResponse[];
  // Distinct country values in use across the tenant's companies, for the
  // Country filter -- there's no dedicated country lookup table, so this is
  // derived from companies rather than fetched as its own resource.
  countries: string[];
  relationshipTypes: RelationshipTypeResponse[];
  industries: IndustryResponse[];
  customerParties: RelationshipRolePickerResponse;
  partnerParties: RelationshipRolePickerResponse;
  // Bulk, id-only deal-partner links for every deal in the tenant, used only
  // to drive the Partner filter below -- companyId/contactId already live
  // directly on DealResponse for the Customer filter, but partners are a
  // separate many-to-many not embedded in the bulk deal list.
  partnerLinks: DealPartnerLinkResponse[];
  initialDeals?: DealResponse[];
  title?: string;
  subtitle?: string;
  addButtonLabel?: string;
  // Needed so the Notes tab in ViewDealDialog knows which notes are the
  // current user's own (only the author can edit a note) -- passed down
  // from the page's own getServerSession() call, same convention as
  // `permissions` being threaded to admin widgets elsewhere in the app.
  currentUserId?: string;
  // Gates the Edit/Delete buttons inside ViewDealDialog -- same
  // `session.permissions` already used everywhere else in the app.
  permissions?: string[];
}

export function FunnelSourceTabs({
  dealSources,
  columns,
  stageOptions,
  stageField = "mainStageName",
  companies,
  employees,
  contacts,
  departments,
  countries,
  relationshipTypes,
  industries,
  customerParties,
  partnerParties,
  partnerLinks,
  initialDeals = [],
  title = "Funnel",
  subtitle = "Track deals by acquisition source",
  addButtonLabel = "Add New Deal",
  currentUserId,
  permissions = [],
}: FunnelSourceTabsProps) {
  const stageIdField = STAGE_ID_FIELD[stageField];
  const canCreateDeals = permissions.includes(PERMISSIONS.DEALS_CREATE);
  const canUpdateDeals = permissions.includes(PERMISSIONS.DEALS_UPDATE);
  const dynamicSources = [
    { id: "all", name: "All" },
    ...dealSources.map((ds) => ({ id: ds.id, name: ds.name })),
  ];

  const sourceColorById = new Map(
    dealSources.map((ds, i) => [ds.id, SOURCE_PALETTE[i % SOURCE_PALETTE.length]])
  );
  const getTabColor = (id: string) => (id === "all" ? ALL_TAB_CONFIG : sourceColorById.get(id) ?? ALL_TAB_CONFIG);

  const [activeId, setActiveId] = useState(dynamicSources[0]?.id ?? "all");
  const [deals, setDeals] = useState<DealResponse[]>(initialDeals);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  // "kind:id" (see parsePartyValue), "" means no filter -- same value scheme
  // as AddDealDialog's Customer/Partner fields.
  const [customerFilter, setCustomerFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [isAddDealOpen, setAddDealOpen] = useState(false);
  const [historyDealId, setHistoryDealId] = useState<string | null>(null);
  const [viewDealId, setViewDealId] = useState<string | null>(null);
  const [editDeal, setEditDeal] = useState<DealResponse | null>(null);

  const { showToast, dismissToast, flushToast } = useToast();
  const { showError } = useAlert();
  const confirm = useConfirm();
  const pendingMovesRef = useRef<Map<string, PendingMove>>(new Map());
  const mountedRef = useRef(true);

  // On unmount (e.g. navigating to another page), any move still sitting in
  // its undo grace period would otherwise be silently lost -- flush it now
  // so it's persisted instead.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingMovesRef.current.forEach((pending) => flushToast(pending.toastId));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFilters =
    search !== "" || department !== "" || country !== "" || customerFilter !== "" || partnerFilter !== "";

  const columnNameById = new Map(columns.map((c) => [c.id, c.name]));
  // Only populated for the Funnel overview board (columns = Main Stages,
  // each carrying its funnel sequence). Used to detect when a drag-and-drop
  // move skips over one or more stages in between, so that can be confirmed
  // before it happens instead of relying on the usual Undo-toast safety net.
  const columnPositionById = new Map(
    columns.filter((c) => c.position !== undefined).map((c) => [c.id, c.position as number]),
  );

  // Names of every Main Stage strictly between fromId and toId (exclusive),
  // in funnel order. Empty when the move is adjacent (or backing up one
  // stage), when either side isn't a Main Stage column, or when position
  // data isn't available -- callers treat an empty result as "not a skip."
  function skippedStageNames(fromId: string, toId: string): string[] {
    const fromPos = columnPositionById.get(fromId);
    const toPos = columnPositionById.get(toId);
    if (fromPos === undefined || toPos === undefined) return [];
    const [lo, hi] = fromPos < toPos ? [fromPos, toPos] : [toPos, fromPos];
    if (hi - lo <= 1) return [];
    return columns
      .filter((c) => c.position !== undefined && c.position > lo && c.position < hi)
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map((c) => c.name);
  }

  const departmentOptions = [
    { value: "", label: "All" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];
  const countryOptions = [
    { value: "", label: "All" },
    ...countries.map((c) => ({ value: c, label: c })),
  ];

  // Customer/Partner filter option lists -- companies and directly-tagged
  // contacts only, same as AddDealDialog's Customer/Partner fields (the
  // pickers behind customerParties/partnerParties no longer inherit a
  // company's tag onto its own untagged contacts, see contacts.service.ts).
  const companyNameById = new Map(companies.map((c) => [c.id, c.name]));
  function toPartyOptions(parties: RelationshipRolePickerResponse): SearchSelectOption[] {
    return [
      ...parties.companies.map((c) => ({
        value: `company:${c.id}`,
        label: c.name,
        sublabel: "Company",
        icon: <BuildingIcon size={14} />,
      })),
      ...parties.contacts.map((c) => ({
        value: `contact:${c.id}`,
        label: c.fullName,
        sublabel: c.companyId ? companyNameById.get(c.companyId) ?? "Person" : "Person (no company)",
        icon: <UserIcon size={14} />,
      })),
    ];
  }
  const customerOptions = toPartyOptions(customerParties);
  const partnerOptions = toPartyOptions(partnerParties);

  // dealId -> set of "kind:id" partner values, for the Partner filter --
  // partners are a separate many-to-many not embedded in DealResponse.
  const partnerValuesByDeal = new Map<string, Set<string>>();
  for (const link of partnerLinks) {
    const value = link.companyId ? `company:${link.companyId}` : link.contactId ? `contact:${link.contactId}` : null;
    if (!value) continue;
    const existing = partnerValuesByDeal.get(link.dealId);
    if (existing) {
      existing.add(value);
    } else {
      partnerValuesByDeal.set(link.dealId, new Set([value]));
    }
  }

  const customerFilterParty = customerFilter ? parsePartyValue(customerFilter) : null;

  const activeDeals = deals
    .filter((d) => activeId === "all" || d.sourceId === activeId)
    .filter((d) => !department || d.departmentId === department)
    .filter((d) => !country || d.companyCountry === country)
    .filter((d) => {
      if (!customerFilterParty) return true;
      return customerFilterParty.kind === "company"
        ? d.companyId === customerFilterParty.id
        : d.contactId === customerFilterParty.id;
    })
    .filter((d) => !partnerFilter || (partnerValuesByDeal.get(d.id)?.has(partnerFilter) ?? false));
  const activeLeads = activeDeals.map((deal) => dealToFunnelLead(deal, stageIdField));
  const activeCfg = getTabColor(activeId);

  // Dropping on a board column always needs a real Sub Stage id to persist
  // (that's what the backend + history rows track). Per-Main-Stage boards
  // already have Sub Stage columns, so the dropped column *is* the target.
  // The tenant-wide overview groups by Main Stage instead, so dropping there
  // is ambiguous as to which Sub Stage -- land in that Main Stage's first
  // Sub Stage in sequence, the same default used when creating a new deal.
  function resolveTarget(droppedColumnId: string): { subStageId: string; mainStageId?: string } | null {
    if (stageField !== "mainStageName") {
      return { subStageId: droppedColumnId };
    }
    const firstSubStage = (stageOptions ?? []).find((s) => s.mainStageId === droppedColumnId);
    if (!firstSubStage) return null;
    return { subStageId: firstSubStage.id, mainStageId: droppedColumnId };
  }

  async function handleMove(dealId: string, droppedColumnId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const currentColumnId = deal[stageIdField] ?? "";
    if (currentColumnId === droppedColumnId) return; // dropped back on its own column

    const target = resolveTarget(droppedColumnId);
    if (!target) {
      showError("This stage doesn't have any sub stages configured yet.", "Can't move deal");
      return;
    }

    // Only the Funnel overview board (Main Stage columns) can skip stages --
    // the per-Main-Stage boards only ever show that stage's own Sub Stages,
    // so there's nothing to skip there. A skip bypasses the usual optimistic
    // move + Undo toast entirely: the user confirms up front instead, and on
    // confirm the move is persisted immediately.
    if (stageField === "mainStageName") {
      const skipped = skippedStageNames(currentColumnId, droppedColumnId);
      if (skipped.length > 0) {
        const targetName = columnNameById.get(droppedColumnId) ?? "this stage";
        const confirmed = await confirm({
          title: "Skip stage(s)?",
          message: `This skips ${skipped.join(", ")} — move "${deal.name}" to ${targetName} anyway?`,
          confirmLabel: "Move anyway",
        });
        if (!confirmed) return;
        void persistMove(dealId, target.subStageId);
        return;
      }
    }

    const existingPending = pendingMovesRef.current.get(dealId);
    if (existingPending) {
      // Re-dragging the same card before its previous move was persisted --
      // cancel that toast/timer silently (nothing was saved yet) and replace
      // it with a fresh grace period for the new target.
      dismissToast(existingPending.toastId);
    }
    const original: PendingMove["original"] = existingPending?.original ?? {
      mainStageId: deal.mainStageId,
      mainStageName: deal.mainStageName,
      currentStageId: deal.currentStageId,
      currentStageName: deal.currentStageName,
    };

    const toastId = showToast({
      message: `Deal moved to ${columnNameById.get(droppedColumnId) ?? "new stage"}`,
      actionLabel: "Undo",
      durationMs: UNDO_GRACE_PERIOD_MS,
      onAction: () => handleUndo(dealId),
      onExpire: () => void persistMove(dealId, target.subStageId),
    });

    pendingMovesRef.current.set(dealId, { toastId, original });

    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const next: DealResponse = { ...d, currentStageId: target.subStageId };
        if (target.mainStageId) {
          next.mainStageId = target.mainStageId;
          next.mainStageName = columnNameById.get(target.mainStageId) ?? d.mainStageName;
        } else {
          next.currentStageName = columnNameById.get(target.subStageId) ?? d.currentStageName;
        }
        return next;
      }),
    );
  }

  function handleUndo(dealId: string) {
    const pending = pendingMovesRef.current.get(dealId);
    if (!pending) return;
    pendingMovesRef.current.delete(dealId);
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...pending.original } : d)));
  }

  async function persistMove(dealId: string, subStageId: string) {
    const pending = pendingMovesRef.current.get(dealId);
    pendingMovesRef.current.delete(dealId);
    try {
      const updated = await moveDeal(dealId, { toStageId: subStageId });
      if (mountedRef.current) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
      }
    } catch (err) {
      if (!mountedRef.current) return;
      showError(err instanceof ApiError ? err.message : "Failed to save the stage change", "Move failed");
      if (pending) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...pending.original } : d)));
      }
    }
  }

  function handleDealCreated(deal: DealResponse) {
    setDeals((prev) => [...prev, deal]);
  }

  function handleDealUpdated(deal: DealResponse) {
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)));
  }

  function handleDealDeleted(dealId: string) {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Title ──────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="mx-0 mt-0 mb-0.5 text-[26px] font-bold text-[var(--color-text)]">
            {title}
          </h1>
          <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        {canCreateDeals && (
          <button
            type="button"
            className="cursor-pointer rounded-lg border-0 bg-[var(--color-crm-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-crm-primary-hover)]"
            onClick={() => setAddDealOpen(true)}
          >
            {addButtonLabel}
          </button>
        )}
      </div>

      {/* ── Filters ──────────────────────── */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="relative w-[280px]">
            <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2 pl-8 pr-3 font-[inherit] text-[13px] transition-colors duration-150 focus:border-[var(--color-crm-primary)] focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <CustomSelect
              label="Department"
              value={department}
              onChange={setDepartment}
              options={departmentOptions}
            />

            <CustomSelect
              label="Country"
              value={country}
              onChange={setCountry}
              options={countryOptions}
            />

            <div className="w-[190px]">
              <SearchSelect
                compact
                value={customerFilter}
                onChange={setCustomerFilter}
                options={customerOptions}
                placeholder="All Customers"
                searchPlaceholder="Search customers..."
              />
            </div>

            <div className="w-[190px]">
              <SearchSelect
                compact
                value={partnerFilter}
                onChange={setPartnerFilter}
                options={partnerOptions}
                placeholder="All Partners"
                searchPlaceholder="Search partners..."
              />
            </div>
          </div>
        </div>

        {hasFilters && (
          <div>
            <button
              type="button"
              className="cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#e2e8f0] hover:text-[var(--color-text)]"
              onClick={() => {
                setSearch("");
                setDepartment("");
                setCountry("");
                setCustomerFilter("");
                setPartnerFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* ── Folder Tabs ──────────────────────── */}
        <div className="relative z-10 flex items-end gap-1 overflow-x-auto pl-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {dynamicSources.map((src) => {
            const cfg = getTabColor(src.id);
            const isActive = activeId === src.id;
            return (
              <button
                key={src.id}
                type="button"
                className={`flex-shrink-0 cursor-pointer rounded-t-lg border border-b-0 pb-[11px] pt-[9px] px-[18px] text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors duration-150 ${
                  isActive
                    ? "border-transparent text-white"
                    : "border-[var(--color-border)] bg-[#e5e7eb] text-[var(--color-text-muted)] hover:bg-[#d1d5db] hover:text-[var(--color-text)]"
                }`}
                style={
                  isActive
                    ? { background: cfg.accent, borderColor: cfg.accent, color: "#fff" }
                    : {}
                }
                onClick={() => setActiveId(src.id)}
              >
                {src.name}
              </button>
            );
          })}
        </div>

        {/* ── Kanban board container ──────────────────────── */}
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          style={{ borderTop: `3px solid ${activeCfg.accent}` }}
        >
          <FunnelBoard
            leads={activeLeads}
            onMove={handleMove}
            columns={columns}
            canDrag={canUpdateDeals}
            onShowHistory={(dealId) => setHistoryDealId(dealId)}
            onViewDeal={(dealId) => setViewDealId(dealId)}
          />
        </div>
      </div>

      {isAddDealOpen && (
        <AddDealDialog
          dealSources={dealSources}
          columns={columns}
          stageOptions={stageOptions}
          companies={companies}
          employees={employees}
          contacts={contacts}
          departments={departments}
          relationshipTypes={relationshipTypes}
          industries={industries}
          customerParties={customerParties}
          partnerParties={partnerParties}
          defaultDealSourceId={activeId !== "all" ? activeId : dealSources[0]?.id}
          onClose={() => setAddDealOpen(false)}
          onCreated={handleDealCreated}
        />
      )}

      {historyDealId && (
        <DealStageHistoryDialog dealId={historyDealId} onClose={() => setHistoryDealId(null)} />
      )}

      {viewDealId && (
        <ViewDealDialog
          dealId={viewDealId}
          currentUserId={currentUserId}
          permissions={permissions}
          onClose={() => setViewDealId(null)}
          onDeleted={(dealId) => {
            handleDealDeleted(dealId);
            setViewDealId(null);
          }}
          onEdit={(deal) => {
            setViewDealId(null);
            setEditDeal(deal);
          }}
        />
      )}

      {editDeal && (
        <AddDealDialog
          mode="edit"
          deal={editDeal}
          dealSources={dealSources}
          columns={columns}
          stageOptions={stageOptions}
          companies={companies}
          employees={employees}
          contacts={contacts}
          departments={departments}
          relationshipTypes={relationshipTypes}
          industries={industries}
          customerParties={customerParties}
          partnerParties={partnerParties}
          onClose={() => setEditDeal(null)}
          onUpdated={(deal) => {
            handleDealUpdated(deal);
            setEditDeal(null);
          }}
        />
      )}
    </div>
  );
}
