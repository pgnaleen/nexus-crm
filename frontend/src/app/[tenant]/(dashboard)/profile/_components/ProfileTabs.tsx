"use client";

import { useState, type ReactNode } from "react";

export interface ProfileTab {
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * Tab shell for My Profile — the first page-level tab strip in the app (every
 * other one lives inside a dialog). Visual language matches the deal dialogs'
 * strip on purpose, one size up for page context.
 *
 * `panel` is a ReactNode rather than a component reference so the server can
 * render each panel and hand the finished tree down. That keeps
 * MyEmployeeRecord and ProfileHeader as Server Components even though the tab
 * state itself has to be client-side.
 *
 * Unlike the dialog rule in CLAUDE.md, panels are deliberately NOT forced to a
 * fixed height: a dialog must not resize under the cursor, but a page that
 * grows and shrinks with its content is normal and avoids a big dead gap
 * under the short tabs.
 */
export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  // Falls back to the first tab if the active one disappears (e.g. an account
  // that loses its linked employee record between renders).
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
