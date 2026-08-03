"use client";

import { useEffect, useRef, useState, type ReactNode, Fragment } from "react";
import { PERMISSIONS, type DealDocumentResponse, type DealNoteResponse, type DealPartnerResponse, type DealResponse, type DealRoleAssignmentResponse } from "@orelia/common";
import {
  createDealNote,
  deleteDeal,
  deleteDealNote,
  getDeal,
  getDealDependentsCount,
  listDealDocuments,
  listDealNotes,
  listDealPartners,
  listDealTeam,
  updateDealNote,
} from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { BuildingIcon, EditIcon, ExternalLinkIcon, FileIcon, FunnelIcon, LegalIcon, FinanceIcon, UsersGroupIcon, TrashIcon, UserIcon } from "@/components/ui/icons";
import { useAlert, useCascadeDeleteConfirm, useConfirm } from "@/components/providers/DialogProvider";
import { computeCosting, formatLkr, formatNoteTime, formatPercent, getInitials } from "@/lib/deals/deal-display";
import { DealStageHistoryRoadmap } from "./DealStageHistoryRoadmap";
import { DealActivityLog } from "./DealActivityLog";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-lg border border-[var(--color-border)] px-3 py-2.5 font-[inherit] text-sm transition-colors duration-150 focus:outline-none focus:border-[var(--color-crm-primary)] focus:shadow-[0_0_0_3px_var(--color-crm-primary-glow)]";

type TabId = "dealInfo" | "delivery" | "costing" | "documents" | "notes" | "competition" | "team" | "history";

const TABS: readonly [TabId, string][] = [
  ["dealInfo", "Deal Information"],
  ["delivery", "Delivery"],
  ["costing", "Costing"],
  ["documents", "Documents"],
  ["notes", "Notes"],
  ["competition", "Competition"],
  ["team", "Team"],
  ["history", "History"],
];

interface ViewDealDialogProps {
  dealId: string;
  currentUserId?: string;
  permissions?: string[];
  onClose: () => void;
  onDeleted?: (dealId: string) => void;
  // Passes the already-fetched deal up rather than just an id -- the Edit
  // dialog (AddDealDialog in edit mode) prefills every field from this
  // object directly, no second fetch needed.
  onEdit?: (deal: DealResponse) => void;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mb-3.5 bg-white/70 border border-slate-200/50 rounded-xl p-3 shadow-[0_1px_2px_rgba(0,0,0,0.015)] hover:border-slate-300/80 hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.035)] transition-all duration-150">
      <div className="text-[9.5px] font-bold text-slate-400/90 uppercase tracking-wider mb-1 select-none">{label}</div>
      <div className="text-[13.5px] font-semibold text-slate-700 leading-snug break-words">
        {value || <span className="text-slate-350 font-normal select-none">—</span>}
      </div>
    </div>
  );
}

export function ViewDealDialog({
  dealId,
  currentUserId,
  permissions = [],
  onClose,
  onDeleted,
  onEdit,
}: ViewDealDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("dealInfo");
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const [scrollProgress, setScrollProgress] = useState({ left: 0, width: 40, show: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 5);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);

    const hasScroll = el.scrollWidth > el.clientWidth;
    if (hasScroll) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const width = Math.max(12, (el.clientWidth / el.scrollWidth) * 40);
      const maxLeft = 40 - width;
      const left = maxScroll > 0 ? (el.scrollLeft / maxScroll) * maxLeft : 0;
      setScrollProgress({ left, width, show: true });
    } else {
      setScrollProgress({ left: 0, width: 40, show: false });
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, [activeTab]);
  const [deal, setDeal] = useState<DealResponse | null>(null);
  const [documents, setDocuments] = useState<DealDocumentResponse[] | null>(null);
  const [partners, setPartners] = useState<DealPartnerResponse[] | null>(null);
  const [team, setTeam] = useState<DealRoleAssignmentResponse[] | null>(null);
  const [notes, setNotes] = useState<DealNoteResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draftNote, setDraftNote] = useState("");
  const [isPostingNote, setIsPostingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteDraft, setEditNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const canDelete = permissions.includes(PERMISSIONS.DEALS_DELETE);
  const canUpdate = permissions.includes(PERMISSIONS.DEALS_UPDATE);
  const confirmCascadeDelete = useCascadeDeleteConfirm();
  const confirm = useConfirm();
  const { showError } = useAlert();

  // Chat-style auto-scroll: jump to the newest note on initial load, after
  // posting, and after deleting.
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ block: "end" });
  }, [notes]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDeal(dealId),
      listDealDocuments(dealId),
      listDealPartners(dealId),
      listDealNotes(dealId),
      listDealTeam(dealId),
    ])
      .then(([dealRes, documentsRes, partnersRes, notesRes, teamRes]) => {
        if (cancelled) return;
        setDeal(dealRes);
        setDocuments(documentsRes);
        setPartners(partnersRes);
        setNotes(notesRes);
        setTeam(teamRes);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Failed to load deal");
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  async function postNote() {
    const text = draftNote.trim();
    if (!text) return;
    setIsPostingNote(true);
    setNoteError(null);
    try {
      const note = await createDealNote(dealId, { text });
      setNotes((prev) => [...(prev ?? []), note]);
      setDraftNote("");
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Failed to post note");
    } finally {
      setIsPostingNote(false);
    }
  }

  function startEditNote(note: DealNoteResponse) {
    setEditingNoteId(note.id);
    setEditNoteDraft(note.text ?? "");
    setNoteError(null);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
  }

  async function saveEditNote(noteId: string) {
    const text = editNoteDraft.trim();
    if (!text) return;
    setNoteError(null);
    try {
      const updated = await updateDealNote(dealId, noteId, { text });
      setNotes((prev) => (prev ?? []).map((n) => (n.id === noteId ? updated : n)));
      setEditingNoteId(null);
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Failed to save note");
    }
  }

  async function deleteNote(noteId: string) {
    const ok = await confirm({
      title: "Delete note",
      message: "Delete this note? This can't be undone.",
      confirmLabel: "Delete",
      isDestructive: true,
    });
    if (!ok) return;
    setNoteError(null);
    try {
      await deleteDealNote(dealId, noteId);
      // Stays in the list as a tombstone -- doesn't disappear -- matching
      // the chat convention of "this message was deleted" rather than
      // silently vanishing.
      const deletedAt = new Date().toISOString();
      setNotes((prev) => (prev ?? []).map((n) => (n.id === noteId ? { ...n, text: null, deletedAt } : n)));
    } catch (err) {
      setNoteError(err instanceof ApiError ? err.message : "Failed to delete note");
    }
  }

  async function handleDelete() {
    if (!deal) return;
    setIsDeleting(true);
    try {
      const { count } = await getDealDependentsCount(dealId);
      const ok = await confirmCascadeDelete({
        title: "Delete Deal",
        warningMessage:
          count > 0
            ? `Deleting "${deal.name}" will also delete ${count} related record${count === 1 ? "" : "s"} (documents, notes, and partner links). This action cannot be undone.`
            : `Deleting "${deal.name}" cannot be undone.`,
      });
      if (!ok) return;

      await deleteDeal(dealId);
      onDeleted?.(dealId);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : "Failed to delete deal");
    } finally {
      setIsDeleting(false);
    }
  }

  if (loadError) {
    return (
      <Dialog open title="View Deal" onClose={onClose} maxWidth="720px">
        <p className="text-[13.5px] text-[var(--color-danger)]">{loadError}</p>
      </Dialog>
    );
  }

  if (!deal) {
    return (
      <Dialog open title="View Deal" onClose={onClose} maxWidth="720px">
        <p className="py-10 text-center text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
      </Dialog>
    );
  }

  const costing = computeCosting(deal.estimatedValue ?? 0, deal.internalCosts ?? 0, deal.externalCosts ?? 0);

  const dialogTitle = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-crm-primary">
        <FunnelIcon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold text-crm-text truncate">
          {deal.name}
        </span>
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] leading-none mt-0.5">
          {deal.companyName || deal.contactName || "No Customer Assigned"}
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open title={dialogTitle} onClose={onClose} maxWidth="960px">
      <div className="relative mb-6">
        {showLeftFade && (
          <div className="absolute left-1 top-1 bottom-1 w-10 bg-gradient-to-r from-slate-100/90 to-transparent pointer-events-none z-10 rounded-l-lg" />
        )}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex flex-nowrap items-center bg-slate-100/90 p-1 rounded-xl select-none border border-slate-200/40 shadow-sm w-full overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none] gap-1"
        >
          {TABS.map(([id, label], idx) => {
            const isActive = activeTab === id;
            
            let cleanLabel = label;
            if (id === "dealInfo") cleanLabel = "Deal Information";
            if (id === "documents") cleanLabel = "Documents";
            if (id === "notes") cleanLabel = "Notes";
            
            let icon = null;
            if (id === "dealInfo") {
              icon = <FunnelIcon size={14} />;
            } else if (id === "delivery") {
              icon = (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              );
            } else if (id === "costing") {
              icon = <FinanceIcon size={14} />;
            } else if (id === "documents") {
              icon = <FileIcon size={14} />;
            } else if (id === "notes") {
              icon = (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              );
            } else if (id === "competition") {
              icon = (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              );
            } else if (id === "team") {
              icon = <UsersGroupIcon size={14} />;
            } else if (id === "history") {
              icon = (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              );
            }

            let clipPath = "";
            if (isActive) {
              const isFirst = idx === 0;
              const isLast = idx === TABS.length - 1;
              if (isFirst) {
                clipPath = "polygon(0 0, 100% 0, 88% 100%, 0 100%)";
              } else if (isLast) {
                clipPath = "polygon(12% 0, 100% 0, 100% 100%, 0 100%)";
              } else {
                clipPath = "polygon(12% 0, 100% 0, 88% 100%, 0 100%)";
              }
            }

            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center justify-center gap-1.5 py-1.5 px-3.5 sm:px-4 font-bold transition-all duration-150 border-none outline-none focus:outline-none cursor-pointer shrink-0 rounded-lg ${
                  isActive
                    ? "text-white select-none"
                    : "text-slate-550 hover:bg-slate-200/50 hover:text-slate-800"
                }`}
              >
                {isActive && (
                  <div 
                    className={`absolute inset-0 bg-crm-primary shadow-sm ${
                      idx === 0 ? "rounded-l-lg" : idx === TABS.length - 1 ? "rounded-r-lg" : ""
                    }`}
                    style={{ clipPath }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 text-[12.5px] sm:text-[13px] whitespace-nowrap">
                  {icon}
                  {cleanLabel}
                </span>
              </button>
            );
          })}
        </div>
        {showRightFade && (
          <div className="absolute right-1 top-1 bottom-1 w-10 bg-gradient-to-l from-slate-100/90 to-transparent pointer-events-none z-10 rounded-r-lg" />
        )}
      </div>

      {scrollProgress.show && (
        <div className="flex justify-center mb-5 -mt-3.5">
          <div className="w-10 h-[3px] bg-slate-200/60 rounded-full relative overflow-hidden">
            <div 
              className="h-full bg-slate-400 rounded-full absolute transition-all duration-75"
              style={{
                left: `${scrollProgress.left}px`,
                width: `${scrollProgress.width}px`
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "dealInfo" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
          {/* Card 1: Deal Basics */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <span className="text-slate-550"><FunnelIcon size={14} /></span>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Deal Basics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
              <Field label="Deal Name" value={deal.name} />
              <Field label="Deal Source" value={deal.sourceName} />
              <Field label="Department" value={deal.departmentName} />
            </div>
          </div>

          {/* Card 2: Customer Assignment */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <span className="text-slate-550"><UserIcon size={14} /></span>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Customer & Assignment</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
              <Field
                label="Customer"
                value={
                  deal.companyName ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-crm-text">
                      <BuildingIcon size={14} /> {deal.companyName}
                    </span>
                  ) : deal.contactName ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-crm-text">
                      <UserIcon size={14} /> {deal.contactName}
                    </span>
                  ) : undefined
                }
              />
              <Field label="Primary Contact" value={deal.primaryContactName} />
            </div>
          </div>

          {/* Card 3: Timeline & Market */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Timeline & Market</span>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
                <Field label="Deal Country" value={deal.dealCountry} />
                <Field label="Expected Deadline" value={deal.expectedCloseDate} />
              </div>
              <Field label="Customer Pain Point" value={deal.customerPainPoint} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "delivery" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
          {/* Card 1: Scope & Solutions */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Scope & Solutions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
              <Field label="Product" value={deal.product} />
              <Field label="Services" value={deal.services} />
            </div>
          </div>

          {/* Card 2: Collaboration */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <span className="text-slate-500"><UsersGroupIcon size={14} /></span>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Partners & Alliances</span>
            </div>
            <div className="space-y-1.5">
              {partners === null ? (
                <p className="text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
              ) : partners.length === 0 ? (
                <p className="text-[13.5px] text-[var(--color-text-muted)]">No partners added.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {partners.map((partner) => (
                    <div
                      key={partner.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 hover:border-slate-300 transition-colors duration-150"
                    >
                      {partner.kind === "company" ? <BuildingIcon size={14} /> : <UserIcon size={14} />}
                      <span className="flex-1 text-[13.5px] font-semibold text-crm-text">{partner.name}</span>
                      {partner.subtitle && (
                        <span className="text-[12px] text-[var(--color-text-muted)]">{partner.subtitle}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "costing" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1 space-y-4">
          {/* Card 1: Costing Base */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <span className="text-slate-550"><FinanceIcon size={14} /></span>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Costing Base</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
              <Field label="Currency" value={deal.currency} />
              <Field label={`Project Value (${deal.currency})`} value={formatLkr(deal.estimatedValue ?? 0)} />
              <Field label={`Internal Costs (${deal.currency})`} value={formatLkr(deal.internalCosts ?? 0)} />
              <Field label={`External Costs (${deal.currency})`} value={formatLkr(deal.externalCosts ?? 0)} />
            </div>
          </div>

          {/* Card 2: Financial Metrics */}
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Financial Metrics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
              <Field label={`Total Cost (${deal.currency})`} value={formatLkr(costing.totalCost)} />
              <Field label={`Profit (${deal.currency})`} value={formatLkr(costing.profit)} />
              <Field label="Project Profit Markup" value={formatPercent(costing.markupPercent)} />
              <Field label="Project Profit Margin" value={formatPercent(costing.marginPercent)} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
          {documents === null ? (
            <p className="text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="deal-empty-tab bg-slate-50/30 rounded-xl border border-dashed border-slate-200 py-6 text-center text-[13.5px] text-[var(--color-text-muted)]">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 no-underline transition-all duration-150 hover:border-crm-primary hover:shadow-sm"
                >
                  <span className="flex flex-shrink-0 text-crm-primary">
                    <FileIcon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="overflow-hidden truncate text-[13.5px] font-bold text-crm-text">
                      {doc.title}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {doc.docType}{doc.version ? ` · ${doc.version}` : ""}
                    </div>
                  </div>
                  <span className="text-slate-400"><ExternalLinkIcon size={14} /></span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "notes" && (
        <div className="flex h-[min(620px,calc(100vh-250px))] flex-col">
          {noteError && <p className="mb-3 text-[12.5px] text-[var(--color-danger)]">{noteError}</p>}
          <div className="flex-1 overflow-y-auto pr-1">
            {notes === null ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
              </div>
            ) : notes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center py-8">
                <p className="text-[13.5px] font-medium text-[var(--color-text)]">No notes yet</p>
                <p className="text-[12.5px] text-[var(--color-text-muted)]">Start the conversation below.</p>
              </div>
            ) : (
              <div className="mb-2 flex flex-col gap-5">
                {notes.map((note) => {
                  const isOwn = note.authorId === currentUserId;
                  const isDeleted = Boolean(note.deletedAt);
                  return (
                    <div key={note.id} className={`flex items-start gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold tracking-[0.02em] text-white ${
                          isDeleted ? "bg-[#cbd5e1]" : isOwn ? "bg-crm-primary" : "bg-[#64748b]"
                        }`}
                        aria-hidden="true"
                      >
                        {getInitials(note.authorName ?? "?")}
                      </div>
                      <div
                        className={`min-w-0 max-w-[75%] rounded-bl-[18px] rounded-br-[18px] px-4 py-3 ${
                          isDeleted
                            ? "border border-dashed border-[var(--color-border)] bg-transparent"
                            : `shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${isOwn ? "bg-crm-primary-tint" : "bg-[#f1f5f9]"}`
                        } ${isOwn ? "rounded-tr-[6px] rounded-tl-[18px]" : "rounded-tl-[6px] rounded-tr-[18px]"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-[var(--color-text)]">
                            {note.authorName ?? "Unknown"}
                          </span>
                          <span className="flex-1 text-[11.5px] text-[var(--color-text-muted)]">
                            {formatNoteTime(note.createdAt)}
                          </span>
                          {isOwn && !isDeleted && editingNoteId !== note.id && (
                            <>
                              <button
                                type="button"
                                className="flex flex-shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-[5px] text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-crm-primary-tint hover:text-crm-primary"
                                aria-label="Edit note"
                                onClick={() => startEditNote(note)}
                              >
                                <EditIcon size={14} />
                              </button>
                              <button
                                type="button"
                                className="flex flex-shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-[5px] text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[#fdf0ee] hover:text-[var(--color-danger)]"
                                aria-label="Delete note"
                                onClick={() => deleteNote(note.id)}
                              >
                                <TrashIcon size={14} />
                              </button>
                            </>
                          )}
                        </div>

                        {isDeleted ? (
                          <p className="mt-1 flex items-center gap-1.5 text-[13px] italic text-[var(--color-text-muted)]">
                            <TrashIcon size={13} />
                            This note was deleted
                          </p>
                        ) : editingNoteId === note.id ? (
                          <>
                            <textarea
                              className={TEXTAREA_CLASS}
                              rows={3}
                              value={editNoteDraft}
                              onChange={(e) => setEditNoteDraft(e.target.value)}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <Button type="button" variant="secondary" onClick={cancelEditNote}>
                                Cancel
                              </Button>
                              <Button type="button" onClick={() => saveEditNote(note.id)}>
                                Save
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--color-text)]">{note.text}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={notesEndRef} />
          </div>

          <div className="flex items-start gap-3 border-t border-[var(--color-border)] pt-4">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-crm-primary text-[12.5px] font-bold tracking-[0.02em] text-white"
              aria-hidden="true"
            >
              <UserIcon size={16} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <textarea
                className={TEXTAREA_CLASS}
                rows={3}
                placeholder="Write a note... (Enter to send, Shift+Enter for a new line)"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    postNote();
                  }
                }}
              />
              <div className="flex justify-end">
                <Button type="button" onClick={postNote} isLoading={isPostingNote} disabled={!draftNote.trim()}>
                  Post Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "competition" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
          {!deal.competitors || deal.competitors.length === 0 ? (
            <p className="deal-empty-tab bg-slate-50/30 rounded-xl border border-dashed border-slate-200 py-6 text-center text-[13.5px] text-[var(--color-text-muted)]">
              No competitors noted.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {deal.competitors.map((competitor, index) => (
                <div
                  key={`${competitor.name}-${index}`}
                  className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80"
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-crm-text mb-2 pb-1.5 border-b border-slate-100">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Competitor #{index + 1}: {competitor.name}
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--color-text-muted)] leading-relaxed mt-1">
                    {competitor.details || "No details provided."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "team" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
          <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 transition-all duration-200 hover:border-slate-300/80">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <span className="text-slate-550"><UsersGroupIcon size={14} /></span>
              <span className="text-[11.5px] font-bold text-slate-600 tracking-wide uppercase">Deal Team Assignment</span>
            </div>
            {(() => {
              const byRole = new Map<string, { roleName: string; primary?: string; teammates: string[] }>();
              for (const a of team ?? []) {
                const entry = byRole.get(a.roleId) ?? { roleName: a.roleName, teammates: [] };
                if (a.isPrimary) entry.primary = a.userDisplayName;
                else entry.teammates.push(a.userDisplayName);
                byRole.set(a.roleId, entry);
              }
              const rows = Array.from(byRole.values());
              if (rows.length === 0) {
                return <p className="text-[12.5px] text-[var(--color-text-muted)]">No team members assigned yet.</p>;
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5">
                  {rows.map((row) => (
                    <Field
                      key={row.roleName}
                      label={row.roleName}
                      value={[row.primary, ...row.teammates].filter(Boolean).join(", ") || undefined}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="h-[min(620px,calc(100vh-250px))] overflow-y-auto pr-1">
          <DealStageHistoryRoadmap dealId={dealId} />
          <DealActivityLog dealId={dealId} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-200/60 pt-4">
        {canDelete ? (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-[18px] py-2.5 text-sm font-semibold text-[var(--color-danger)] transition-colors duration-150 hover:bg-red-50 hover:border-red-100/50 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus:outline-none"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <TrashIcon size={14} /> Delete Deal
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2.5">
          {canUpdate && (
            <Button type="button" onClick={() => onEdit?.(deal)}>
              Edit
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
