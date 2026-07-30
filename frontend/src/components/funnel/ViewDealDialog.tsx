"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PERMISSIONS, type DealDocumentResponse, type DealNoteResponse, type DealPartnerResponse, type DealResponse } from "@orelia/common";
import {
  createDealNote,
  deleteDeal,
  deleteDealNote,
  getDeal,
  getDealDependentsCount,
  listDealDocuments,
  listDealNotes,
  listDealPartners,
  updateDealNote,
} from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { BuildingIcon, EditIcon, ExternalLinkIcon, FileIcon, TrashIcon, UserIcon } from "@/components/ui/icons";
import { useAlert, useCascadeDeleteConfirm, useConfirm } from "@/components/providers/DialogProvider";
import { computeCosting, formatLkr, formatNoteTime, formatPercent, getInitials } from "@/lib/deals/deal-display";
import { DealStageHistoryRoadmap } from "./DealStageHistoryRoadmap";

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
    <div className="mb-[18px]">
      <div className="mb-1 text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</div>
      <div className="text-[13.5px] text-[var(--color-text)]">{value || <span className="text-[var(--color-text-muted)]">—</span>}</div>
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
  const [deal, setDeal] = useState<DealResponse | null>(null);
  const [documents, setDocuments] = useState<DealDocumentResponse[] | null>(null);
  const [partners, setPartners] = useState<DealPartnerResponse[] | null>(null);
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
    Promise.all([getDeal(dealId), listDealDocuments(dealId), listDealPartners(dealId), listDealNotes(dealId)])
      .then(([dealRes, documentsRes, partnersRes, notesRes]) => {
        if (cancelled) return;
        setDeal(dealRes);
        setDocuments(documentsRes);
        setPartners(partnersRes);
        setNotes(notesRes);
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

  return (
    <Dialog open title={deal.name} onClose={onClose} maxWidth="720px">
      {/* Single row, never wrapping -- History used to drop onto its own second
          row once all 8 tabs no longer fit the 720px dialog. Tabs keep their
          natural width (shrink-0) and the strip scrolls horizontally instead. */}
      <div className="-mx-5 -mt-5 mb-5 flex flex-nowrap gap-x-4 overflow-x-auto border-b border-[var(--color-border)] px-5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`shrink-0 cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent px-1 py-3 text-[13.5px] font-semibold transition-colors duration-150 hover:text-[var(--color-text)] ${
              activeTab === id
                ? "border-b-[var(--color-crm-primary)] text-[var(--color-crm-primary)]"
                : "border-b-transparent text-[var(--color-text-muted)]"
            }`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "dealInfo" && (
        <div className="min-h-[420px]">
          <Field label="Deal Name" value={deal.name} />
          <Field label="Deal Source" value={deal.sourceName} />
          <Field
            label="Customer"
            value={
              deal.companyName ? (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingIcon size={14} /> {deal.companyName}
                </span>
              ) : deal.contactName ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserIcon size={14} /> {deal.contactName}
                </span>
              ) : undefined
            }
          />
          <Field label="Primary Contact" value={deal.primaryContactName} />
          <Field label="Deal Country" value={deal.dealCountry} />
          <Field label="Expected Deadline" value={deal.expectedCloseDate} />
          <Field label="Customer Pain Point" value={deal.customerPainPoint} />
          <Field label="Department" value={deal.departmentName} />
        </div>
      )}

      {activeTab === "delivery" && (
        <div className="min-h-[420px]">
          <div className="mb-[18px]">
            <div className="mb-1.5 text-[13px] font-semibold text-[var(--color-text-muted)]">
              Partners (Companies or Contacts)
            </div>
            {partners === null ? (
              <p className="text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
            ) : partners.length === 0 ? (
              <p className="text-[13.5px] text-[var(--color-text-muted)]">No partners added.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  >
                    {partner.kind === "company" ? <BuildingIcon size={14} /> : <UserIcon size={14} />}
                    <span className="text-[13.5px] text-[var(--color-text)]">{partner.name}</span>
                    {partner.subtitle && (
                      <span className="text-[12px] text-[var(--color-text-muted)]">{partner.subtitle}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Field label="Product" value={deal.product} />
          <Field label="Services" value={deal.services} />
        </div>
      )}

      {activeTab === "costing" && (
        <div className="min-h-[420px]">
          <Field label="Currency" value={deal.currency} />
          <Field label={`Project Value without Tax (${deal.currency})`} value={formatLkr(deal.estimatedValue ?? 0)} />
          <Field label={`Internal Costs (${deal.currency})`} value={formatLkr(deal.internalCosts ?? 0)} />
          <Field label={`External Costs (${deal.currency})`} value={formatLkr(deal.externalCosts ?? 0)} />
          <Field label={`Total Cost (${deal.currency})`} value={formatLkr(costing.totalCost)} />
          <Field label={`Profit (${deal.currency})`} value={formatLkr(costing.profit)} />
          <Field label="Project Profit Markup" value={formatPercent(costing.markupPercent)} />
          <Field label="Project Profit Margin" value={formatPercent(costing.marginPercent)} />
        </div>
      )}

      {activeTab === "documents" && (
        <div className="min-h-[420px]">
          {documents === null ? (
            <p className="text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="text-[var(--color-text-muted)]">No documents uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 no-underline transition-colors duration-150 hover:border-[var(--color-crm-primary)]"
                >
                  <span className="flex flex-shrink-0 text-[var(--color-brand)]">
                    <FileIcon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="overflow-hidden truncate text-[13.5px] font-medium text-[var(--color-text)]">
                      {doc.title}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{doc.docType}</div>
                  </div>
                  <ExternalLinkIcon size={14} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "notes" && (
        <div className="flex h-[min(480px,calc(100vh-260px))] flex-col">
          {noteError && <p className="mb-3 text-[12.5px] text-[var(--color-danger)]">{noteError}</p>}
          <div className="flex-1 overflow-y-auto pr-1">
            {notes === null ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>
              </div>
            ) : notes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
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
        <div className="min-h-[420px]">
          {!deal.competitors || deal.competitors.length === 0 ? (
            <p className="text-[var(--color-text-muted)]">No competitors noted.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {deal.competitors.map((competitor, index) => (
                <div
                  key={`${competitor.name}-${index}`}
                  className="flex flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-white p-[14px]"
                >
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">{competitor.name}</span>
                  <span className="whitespace-pre-wrap text-[13px] text-[var(--color-text-muted)]">
                    {competitor.details}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "team" && (
        <div className="min-h-[420px]">
          <Field label="Sales Person" value={deal.ownerName} />
          <Field label="Pre-Sales Person" value={deal.preSalesPersonName} />
          <Field label="PMO" value={deal.pmoName} />
        </div>
      )}

      {activeTab === "history" && (
        <div className="min-h-[420px]">
          <DealStageHistoryRoadmap dealId={dealId} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {canDelete ? (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-3 py-2 text-[13px] font-semibold text-[var(--color-danger)] transition-colors duration-150 hover:bg-[#fdf0ee] disabled:cursor-not-allowed disabled:opacity-50"
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
            <Button type="button" variant="secondary" onClick={() => onEdit?.(deal)}>
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
