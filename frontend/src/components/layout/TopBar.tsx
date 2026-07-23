"use client";

import { useState, useEffect } from "react";
import { AccountMenu } from "./AccountMenu";
import { NotificationPanel } from "./NotificationPanel";
import { SearchIcon } from "@/components/ui/icons";

interface TopBarProps {
  tenantName: string;
  userDisplayName: string;
  tenantSlug: string;
}

export function TopBar({ tenantName, userDisplayName, tenantSlug }: TopBarProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = time
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(time)
    : "";
  
  const formattedTime = time
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(time)
    : "";

  return (
    <header className="flex flex-shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-white px-6 py-3.5">
      <div className="relative w-80 transition-[width] duration-200 focus-within:w-[400px]">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-text-muted)]">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search..."
          className="w-full rounded-lg border border-[var(--color-border)] bg-[#f5f6fa] py-[7px] pr-3 pl-8 text-[13px] focus:border-crm-primary focus:bg-white focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {time && (
          <div className="mr-2 flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--color-text-muted)]">{formattedDate}</span>
            <span className="text-[13px] font-semibold text-[var(--color-text)] tabular-nums">{formattedTime}</span>
          </div>
        )}

        <NotificationPanel />

        <AccountMenu tenantName={tenantName} userDisplayName={userDisplayName} tenantSlug={tenantSlug} />
      </div>
    </header>
  );
}
