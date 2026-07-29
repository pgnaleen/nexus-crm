"use client";

import { useState, type ReactNode } from "react";

export interface PageTab {
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * Tab shell for page-level tab strips (as opposed to the dialog tab strip
 * in CLAUDE.md's multi-tab dialog rule -- that's a separate pattern, for a
 * separate context). Originally built for My Profile; Employees >
 * Certifications is the second consumer.
 *
 * `panel` is a ReactNode rather than a component reference so the server can
 * render each panel and hand the finished tree down. That keeps
 * Server Component panels (or "use client" ones with their own state, like
 * Profile's MyCertifications) working identically -- the tab shell only
 * needs to own which one is currently visible.
 *
 * Unlike the dialog rule in CLAUDE.md, panels are deliberately NOT forced to a
 * fixed height: a dialog must not resize under the cursor, but a page that
 * grows and shrinks with its content is normal and avoids a big dead gap
 * under the short tabs.
 */
export function PageTabs({ tabs }: { tabs: PageTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  // Falls back to the first tab if the active one disappears (e.g. a
  // permission or linked-record condition changes which tabs exist between
  // renders).
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="content-card">
      <div
        role="tablist"
        // -mx-4/-mt-4/px-4 must track .content-card's 16px padding so the
        // underline runs edge to edge. Note this is 16, not the 20 the deal
        // dialogs use -- .content-card and .dialog have different padding.
        className="-mx-4 -mt-4 mb-5 flex flex-nowrap gap-x-5 overflow-x-auto border-b border-[var(--color-border)] px-4"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              className={`shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-1 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 hover:text-[var(--color-text)] ${
                isActive
                  ? "border-b-[var(--color-crm-primary)] text-[var(--color-crm-primary)]"
                  : "border-b-transparent text-[var(--color-text-muted)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{active?.panel}</div>
    </div>
  );
}
