"use client";

import { useEffect, useState } from "react";
import type { DealStageHistoryResponse } from "@orelia/common";
import { listDealStageHistory } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { ActivityIcon } from "@/components/ui/icons";

interface DealStageHistoryDialogProps {
  dealId: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function DealStageHistoryDialog({ dealId, onClose }: DealStageHistoryDialogProps) {
  const [entries, setEntries] = useState<DealStageHistoryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    listDealStageHistory(dealId)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load stage history");
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  return (
    <Dialog open title="Stage History" onClose={onClose} maxWidth="480px">
      {error && <p className="field-error">{error}</p>}
      {!error && entries === null && <p className="deal-empty-tab">Loading…</p>}
      {!error && entries !== null && entries.length === 0 && (
        <p className="deal-empty-tab">No stage moves recorded yet.</p>
      )}
      {!error && entries !== null && entries.length > 0 && (
        <div className="stage-history-list">
          {entries.map((entry) => (
            <div key={entry.id} className="stage-history-item">
              <span className="stage-history-icon">
                <ActivityIcon size={14} />
              </span>
              <div className="stage-history-body">
                <div className="stage-history-line">
                  <span className="stage-history-kind">
                    {entry.kind === "main_stage" ? "Main Stage" : "Sub Stage"}
                  </span>{" "}
                  {entry.fromStageName ? (
                    <>
                      <strong>{entry.fromStageName}</strong> → <strong>{entry.toStageName}</strong>
                    </>
                  ) : (
                    <>
                      Set to <strong>{entry.toStageName}</strong>
                    </>
                  )}
                </div>
                <div className="stage-history-meta">
                  {entry.movedByName ?? "Unknown"} · {formatDate(entry.movedAt)}
                  {entry.note ? ` · "${entry.note}"` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
