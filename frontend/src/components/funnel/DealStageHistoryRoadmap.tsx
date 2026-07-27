"use client";

import { useEffect, useState } from "react";
import type { DealStageHistoryResponse } from "@orelia/common";
import { listDealStageHistory } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/client";

interface DealStageHistoryRoadmapProps {
  dealId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

// Presentational-only: fetches and renders a deal's stage-move history as a
// vertical roadmap (oldest at top, current stage at bottom -- a journey
// reads start-to-now). No <Dialog> wrapper, so this drops inline into a tab
// or gets wrapped by DealStageHistoryDialog for the popup entry point --
// same data, same component, two different homes.
export function DealStageHistoryRoadmap({ dealId }: DealStageHistoryRoadmapProps) {
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

  if (error) {
    return <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">{error}</p>;
  }

  if (entries === null) {
    return <p className="py-5 text-center text-[13.5px] text-[var(--color-text-muted)]">Loading…</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="py-5 text-center text-[13.5px] text-[var(--color-text-muted)]">
        No stage moves recorded yet.
      </p>
    );
  }

  // API returns newest-first; a roadmap reads as a journey from start to
  // now, so the timeline itself displays oldest-first, current stage last.
  const chronological = entries.slice().reverse();

  return (
    <div className="max-h-[480px] overflow-y-auto py-1">
      {chronological.map((entry, index) => {
        const isCurrent = index === chronological.length - 1;
        const isMainStage = entry.kind === "main_stage";
        // toStageName is only ever null for a "sub_stage" entry recording a
        // move that left the deal with no Sub Stage (a Main-Stage-only
        // position) -- a real, meaningful state, not a missing value.
        const toLabel = entry.toStageName ?? "No sub stage";
        const transition = entry.fromStageName ? (
          <>
            <span className="text-[var(--color-text-muted)]">{entry.fromStageName}</span>
            <span className="mx-1.5 text-[var(--color-text-muted)]">→</span>
            <span>{toLabel}</span>
          </>
        ) : (
          <>
            <span className="text-[var(--color-text-muted)]">Set to</span> <span>{toLabel}</span>
          </>
        );

        return (
          <div
            key={entry.id}
            className={`relative flex gap-3 pb-5 pl-1 last:pb-0 ${isMainStage ? "" : "ml-4"}`}
          >
            {/* Connecting line -- omitted after the last entry */}
            {index < chronological.length - 1 && (
              <span
                className="absolute left-[13px] top-6 bottom-0 w-px bg-[var(--color-border)]"
                aria-hidden="true"
              />
            )}

            {/* Marker */}
            <span
              className={`relative z-[1] flex flex-shrink-0 items-center justify-center rounded-full font-bold ${
                isMainStage ? "h-7 w-7 text-[12px]" : "h-5 w-5 text-[10px]"
              }`}
              style={
                isCurrent
                  ? { background: "var(--color-crm-primary)", color: "#fff" }
                  : isMainStage
                    ? { background: "var(--color-crm-primary-tint)", color: "var(--color-crm-primary)", border: "1.5px solid var(--color-crm-primary)" }
                    : { background: "#fff", color: "var(--color-text-muted)", border: "1.5px solid var(--color-border)" }
              }
            >
              {isMainStage ? "★" : "•"}
            </span>

            {/* Content */}
            <div
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 ${
                isMainStage ? "bg-[var(--color-crm-primary-tint)]" : ""
              }`}
            >
              <div className={`text-[13.5px] ${isMainStage ? "font-bold text-[var(--color-crm-primary)]" : "font-medium text-[var(--color-text)]"}`}>
                {transition}
                {isCurrent && (
                  <span className="ml-2 rounded bg-[var(--color-crm-primary)] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.03em] text-white">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {entry.movedByName ?? "Unknown"} · {formatDate(entry.movedAt)}
              </div>
              {entry.note && (
                <div className="mt-1 text-[12px] italic text-[var(--color-text-muted)]">&ldquo;{entry.note}&rdquo;</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
