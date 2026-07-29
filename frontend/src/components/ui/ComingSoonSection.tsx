import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

interface ComingSoonSectionProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
}

// Shared placeholder for sidebar sections that exist in the nav now but
// whose real functionality is being built later (Legal, Finance, Deal
// Registration, Leads -- see Sidebar.tsx's MAIN_SECTIONS). Once a section's
// real UI is built, its page.tsx stops rendering this; the other
// placeholders are unaffected.
//
// Uses bg-crm-primary-tint/text-crm-primary for the icon tile rather than
// the shared .empty-state-icon class -- that class still hardcodes the old
// ad-hoc blue (#eef1fb/--color-brand), a pre-existing "no blue anywhere"
// violation in globals.css that's out of scope to fix here (see the
// StatCard/ActivityWidget precedent in CLAUDE.md for why that fix happens
// as its own dedicated pass, not a side effect of unrelated work).
export function ComingSoonSection({ title, subtitle, icon }: ComingSoonSectionProps) {
  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h1 className="m-0 mb-0.5 text-[26px] font-bold text-crm-text">{title}</h1>
        <p className="m-0 text-[13.5px] text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
      <div className="content-card">
        <div className="empty-state">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-crm-primary-tint text-crm-primary">
            {icon}
          </div>
          <p className="empty-state-title">{t("common.comingSoon.title")}</p>
          <p className="empty-state-message">{t("common.comingSoon.message")}</p>
        </div>
      </div>
    </div>
  );
}
